import { dirname, resolve } from 'node:path'

// Local architectural checks. No type checker or external lint runtime required.
function property(node) {
  return node.computed ? node.property.value : node.property.name
}

function binding(context, node) {
  let scope = context.sourceCode.getScope(node)
  while (scope) {
    const variable = scope.set.get(node.name)
    if (variable) {
      return variable
    }
    scope = scope.upper
  }
}

function importDefinition(context, node) {
  if (node?.type !== 'Identifier') {
    return null
  }
  return binding(context, node)?.defs.find((def) => def.type === 'ImportBinding') ?? null
}

function importedFrom(context, node) {
  return importDefinition(context, node)?.parent?.source?.value ?? null
}

// Resolve canonical app aliases and relative paths without loading application code.
function area(context, source) {
  if (typeof source !== 'string') {
    return null
  }
  if (source.startsWith('#')) {
    return source.slice(1).split('/')[0]
  }
  if (!source.startsWith('.')) {
    return null
  }
  const path = resolve(dirname(context.filename), source).replaceAll('\\', '/')
  return path.match(/\/apps\/api\/app\/([^/]+)\//)?.[1] ?? null
}

function collaborator(context, source) {
  return ['services', 'actions'].includes(area(context, source))
}

function parameterType(parameter) {
  let param = parameter.type === 'TSParameterProperty' ? parameter.parameter : parameter
  if (param.type === 'AssignmentPattern') {
    param = param.left
  }
  const type = param.typeAnnotation?.typeAnnotation
  return type?.type === 'TSTypeReference' ? type.typeName : null
}

function injected(context, node) {
  return (
    node.decorators?.some(({ expression }) => {
      if (expression.type !== 'CallExpression') {
        return false
      }
      const callee = expression.callee
      if (callee.type === 'MemberExpression' && property(callee) === 'inject') {
        return (
          importedFrom(context, callee.object) === '@adonisjs/core' &&
          importDefinition(context, callee.object)?.node.type === 'ImportNamespaceSpecifier'
        )
      }
      const definition = importDefinition(context, callee)
      return (
        definition?.parent.source.value === '@adonisjs/core' &&
        definition.node.imported?.name === 'inject'
      )
    }) ?? false
  )
}

function injectable(context, type) {
  const source = importedFrom(context, type)
  const name = importDefinition(context, type)?.node.imported?.name
  return (
    collaborator(context, source) ||
    (source === '@adonisjs/core/http' && name === 'HttpContext') ||
    (source === '@adonisjs/core/logger' && name === 'Logger')
  )
}

function runtimeImport(node) {
  if (node.importKind === 'type' || node.exportKind === 'type') {
    return false
  }
  return (
    !node.specifiers?.length ||
    node.specifiers.some(
      (specifier) => specifier.importKind !== 'type' && specifier.exportKind !== 'type',
    )
  )
}

function importsMatching(context, report, matches) {
  const visit = (node) => {
    if (runtimeImport(node) && matches(node.source?.value)) {
      report(node)
    }
  }
  return {
    ImportDeclaration: visit,
    ExportNamedDeclaration: visit,
    ExportAllDeclaration: visit,
    ImportExpression(node) {
      if (matches(node.source.value)) {
        report(node)
      }
    },
  }
}

function rule(message, visitors) {
  return {
    meta: { type: 'problem', schema: [], messages: { convention: message } },
    create(context) {
      return visitors(context, (node) => context.report({ node, messageId: 'convention' }))
    },
  }
}

export default {
  meta: { name: 'adonis-conventions', version: '1.1.0' },
  rules: {
    'no-migration-defer': rule(
      'Do not use this.defer in migrations. Use a seeder, or document a necessary schema-coupled backfill with a narrow suppression.',
      (_context, report) => ({
        MemberExpression(node) {
          if (node.object.type === 'ThisExpression' && property(node) === 'defer') {
            report(node)
          }
        },
      }),
    ),
    'no-controller-database': rule(
      'Move database-client orchestration into a service or Action. Controllers should coordinate HTTP input/output; simple model calls are allowed.',
      (_context, report) => ({
        ImportDeclaration(node) {
          if (
            ['@adonisjs/lucid/services/db', '@adonisjs/lucid/database'].includes(node.source.value)
          ) {
            report(node)
          }
        },
      }),
    ),
    'no-service-http': rule(
      'Keep services and Actions independent of HTTP. Pass explicit inputs instead of importing HttpContext or controllers.',
      (_context, report) => ({
        ImportDeclaration(node) {
          if (
            node.source.value === '@adonisjs/core/http' ||
            /^#controllers\//.test(node.source.value)
          ) {
            report(node)
          }
        },
      }),
    ),
    'no-new-service': rule(
      'Inject service/Action collaborators instead of constructing them here. Stateless function imports remain allowed.',
      (context, report) => ({
        NewExpression(node) {
          if (collaborator(context, importedFrom(context, node.callee))) {
            report(node)
          }
        },
      }),
    ),
    'require-constructor-inject': rule(
      'Use class-level @inject() for service/Action, HttpContext, or Logger constructor dependencies resolved by the container.',
      (context, report) => ({
        MethodDefinition(node) {
          if (node.kind !== 'constructor') {
            return
          }
          if (
            node.value.params.some((param) => injectable(context, parameterType(param))) &&
            !injected(context, node.parent.parent)
          ) {
            report(node)
          }
        },
      }),
    ),
    'require-method-inject': rule(
      'Add method-level @inject() for controller service/Action parameters after HttpContext. A class decorator does not enable method injection.',
      (context, report) => ({
        MethodDefinition(node) {
          if (
            node.kind === 'constructor' ||
            node.static ||
            node.accessibility === 'private' ||
            node.accessibility === 'protected'
          ) {
            return
          }
          const firstType = parameterType(node.value.params[0] ?? {})
          if (
            importedFrom(context, firstType) !== '@adonisjs/core/http' ||
            importDefinition(context, firstType)?.node.imported?.name !== 'HttpContext'
          ) {
            return
          }
          if (
            node.value.params.slice(1).some((param) => injectable(context, parameterType(param))) &&
            !injected(context, node)
          ) {
            report(node)
          }
        },
      }),
    ),
    'injection-runtime-imports': rule(
      'Auto-resolved injection dependencies need runtime imports, not import type. The controller method HttpContext argument is supplied by the router and may remain type-only.',
      (context, report) => ({
        MethodDefinition(node) {
          let params
          if (node.kind === 'constructor' && injected(context, node.parent.parent)) {
            params = node.value.params
          } else if (node.kind !== 'constructor' && injected(context, node)) {
            // Other container.call callers may supply arbitrary runtime arguments.
            // Restrict method checking to controller HTTP handlers with known slots.
            const filename = context.filename.replaceAll('\\', '/')
            const first = parameterType(node.value.params[0] ?? {})
            if (
              !filename.includes('/apps/api/app/controllers/') ||
              importedFrom(context, first) !== '@adonisjs/core/http' ||
              importDefinition(context, first)?.node.imported?.name !== 'HttpContext'
            ) {
              return
            }
            params = node.value.params.slice(1)
          } else {
            return
          }
          for (const param of params) {
            const definition = importDefinition(context, parameterType(param))
            if (
              definition &&
              (definition.parent.importKind === 'type' || definition.node.importKind === 'type')
            ) {
              report(param)
            }
          }
        },
      }),
    ),
    'no-runtime-models-in-migrations': rule(
      'Keep migrations independent of current application models and generated schemas. Use the migration query client for data changes.',
      (context, report) =>
        importsMatching(context, report, (source) => {
          if (area(context, source) === 'models') {
            return true
          }
          if (typeof source !== 'string') {
            return false
          }
          if (/^#database\/schema(?:\.[cm]?[jt]s)?$/.test(source)) {
            return true
          }
          return (
            source.startsWith('.') &&
            /\/apps\/api\/database\/schema(?:\.[cm]?[jt]s)?$/.test(
              resolve(dirname(context.filename), source).replaceAll('\\', '/'),
            )
          )
        }),
    ),
    'no-controller-import': rule(
      'Do not reuse a controller as a service. Extract shared behavior into a service or Action.',
      (context, report) =>
        importsMatching(context, report, (source) => area(context, source) === 'controllers'),
    ),
    'prefer-static-imports': rule(
      'Use a static import in application code. Keep dynamic imports at explicit lazy-loading boundaries such as routes and providers.',
      (_context, report) => ({ ImportExpression: report }),
    ),
    'use-validated-env': rule(
      'Read validated environment values through #start/env instead of process.env.',
      (context, report) => ({
        MemberExpression(node) {
          if (node.object.type !== 'Identifier' || property(node) !== 'env') {
            return
          }
          const source = importedFrom(context, node.object)
          const globalProcess =
            node.object.name === 'process' && !binding(context, node.object)?.defs.length
          if (globalProcess || source === 'node:process' || source === 'process') {
            report(node)
          }
        },
        ImportDeclaration(node) {
          if (!['node:process', 'process'].includes(node.source.value)) {
            return
          }
          for (const specifier of node.specifiers) {
            if (specifier.imported?.name === 'env') {
              report(specifier)
            }
          }
        },
      }),
    ),
  },
}

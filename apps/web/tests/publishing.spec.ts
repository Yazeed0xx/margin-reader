import { test, expect } from '@playwright/test'

import type { Page, APIRequestContext } from '@playwright/test'

const base = 'http://localhost:3340/api/v1'
async function account(request: APIRequestContext) {
  const response = await request.post(`${base}/auth/signup`, {
    data: {
      fullName: 'Browser Test Writer',
      email: `qa-${crypto.randomUUID()}@example.test`,
      password: 'test-password-123',
      passwordConfirmation: 'test-password-123',
    },
  })
  expect(response.ok()).toBeTruthy()
  return (await response.json()).data as { token: string; user: { id: number } }
}
async function signIn(page: Page, token: string) {
  await page.goto('/')
  await page.evaluate((token) => sessionStorage.setItem('margin.token', token), token)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Account', exact: true })).toBeVisible()
}
async function article(request: APIRequestContext, token: string) {
  const headers = { Authorization: `Bearer ${token}` }
  const blocks = Array.from({ length: 12 }, (_, index) => ({
    id: `paragraph-${index}`,
    type: 'paragraph',
    text:
      `Paragraph ${index + 1}. ` +
      'A thoughtful essay lets us follow an idea, inspect its sources, and return to the same place. '.repeat(
        5,
      ),
  }))
  const created = await request.post(`${base}/account/articles`, {
    headers,
    data: {
      title: 'An essay for careful reading',
      language: 'en',
      content: { version: 1, blocks },
    },
  })
  expect(created.ok()).toBeTruthy()
  const draft = (await created.json()).data
  await request.post(`${base}/account/articles/${draft.id}/publish`, {
    headers,
    data: { expectedVersion: draft.lockVersion },
  })
  return draft.id as number
}

test('writer can create, protect unsaved edits, publish, bookmark, and unpublish', async ({
  page,
}) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'New here? Create an account' }).click()
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Writing Test')
  await page.getByRole('textbox', { name: 'Email' }).fill(`ui-${crypto.randomUUID()}@example.test`)
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('test-password-123')
  await page.getByRole('textbox', { name: 'Confirm password' }).fill('test-password-123')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page).toHaveURL('http://localhost:5180/')
  await page.getByRole('button', { name: 'Write', exact: true }).click()
  await page.getByRole('textbox', { name: 'Essay title' }).fill('A browser-tested idea')
  await page
    .getByRole('textbox', { name: 'Block 1', exact: true })
    .fill('The first paragraph stays with the reader.')
  await page.getByRole('link', { name: 'Explore', exact: true }).click()
  await expect(page.getByText('Keep your unsaved work?')).toBeVisible()
  await page.getByRole('button', { name: 'Keep writing' }).click()
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page).toHaveURL(/\/write\/\d+/)
  const editorUrl = page.url()
  await page.getByRole('button', { name: 'Publish essay', exact: true }).click()
  await page.getByRole('button', { name: 'Read live essay' }).click()
  await expect(
    page.getByRole('heading', { name: 'A browser-tested idea', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Save for later' }).click()
  await expect(page.getByRole('button', { name: 'Saved · remove' })).toBeVisible()
  await page.getByRole('link', { name: 'Saved', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'A browser-tested idea' })).toBeVisible()
  await page.goto(editorUrl)
  await page.getByRole('button', { name: 'Unpublish', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Ready for readers?' })).toBeVisible()
  await page.goto('/saved')
  await expect(page.getByText('Save an essay while reading.')).toBeVisible()
})

test('stale draft saves preserve the local text and offer recovery', async ({ page, request }) => {
  const user = await account(request)
  const id = await article(request, user.token)
  await signIn(page, user.token)
  await page.goto(`/write/${id}`)
  await page.getByRole('textbox', { name: 'Essay title' }).fill('My unsaved local title')
  const headers = { Authorization: `Bearer ${user.token}` }
  const current = (await (await request.get(`${base}/account/articles/${id}`, { headers })).json())
    .data
  await request.put(`${base}/account/articles/${id}`, {
    headers,
    data: {
      expectedVersion: current.lockVersion,
      title: 'Changed in another tab',
      language: 'en',
      content: current.draft.content,
    },
  })
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByText('This version changed elsewhere.', { exact: false })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Essay title' })).toHaveValue(
    'My unsaved local title',
  )
  await expect(page.getByRole('button', { name: 'Download your draft' })).toBeVisible()
})

test('inline source preserves scroll and focus; video is opt-in and removed on close', async ({
  page,
  request,
}) => {
  const user = await account(request)
  const id = await article(request, user.token)
  // The source fixture and YouTube SDK are deterministic; account, draft, and progress tests use real APIs.
  const response = (await (await request.get(`${base}/articles/${id}`)).json()).data
  response.references = [
    {
      referenceKey: 'video-source',
      blockId: 'paragraph-6',
      resourceId: 1,
      commentary: 'The source behind this paragraph',
      selectedQuote: null,
      videoStartSeconds: 15,
    },
  ]
  await page.route(`**/api/v1/articles/${id}`, (route) =>
    route.fulfill({ json: { data: response } }),
  )
  await page.route(`**/api/v1/articles/${id}/sources/video-source?*`, (route) =>
    route.fulfill({
      json: {
        data: {
          reference: response.references[0],
          resource: {
            id: 1,
            url: 'https://www.youtube.com/watch?v=M7lc1UVf-VE',
            kind: 'video',
            processingStatus: 'ready',
            title: 'Video evidence',
            siteName: 'YouTube',
            displayPolicy: 'embed',
            playback: { provider: 'youtube', videoId: 'M7lc1UVf-VE' },
          },
        },
      },
    }),
  )
  await page.route('https://www.youtube.com/iframe_api', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `window.YT={Player:class {constructor(el,options){this.frame=document.createElement('iframe');this.frame.title='Test YouTube player';this.frame.src='about:blank';el.replaceWith(this.frame);options.events.onReady({target:this});}getIframe(){return this.frame}getCurrentTime(){return 22}destroy(){this.frame.remove()}}};window.onYouTubeIframeAPIReady();`,
    }),
  )
  await page.goto(`/articles/${id}`)
  const citation = page.getByRole('button', { name: 'Source 1', exact: true })
  await citation.scrollIntoViewIfNeeded()
  await citation.focus()
  const before = await page.evaluate(() => scrollY)
  await citation.click()
  await expect(page.getByRole('heading', { name: 'Video evidence' })).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('inline-reader.png') })
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('#block-paragraph-6')).toBeVisible()
  await expect(page.locator('iframe')).toHaveCount(0)
  await page.getByRole('button', { name: 'Load YouTube player · 0:15' }).click()
  await expect(page.locator('iframe')).toHaveCount(1)
  await page.getByRole('button', { name: 'Continue the essay' }).click()
  await expect(page.locator('iframe')).toHaveCount(0)
  await expect(citation).toBeFocused()
  expect(Math.abs((await page.evaluate(() => scrollY)) - before)).toBeLessThan(2)
})

test('mobile Arabic layout fits and reading position survives reload', async ({
  page,
  request,
}) => {
  const user = await account(request)
  const id = await article(request, user.token)
  await signIn(page, user.token)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`/articles/${id}`)
  await expect(page.locator('#block-paragraph-0')).toBeVisible()
  await page.locator('#block-paragraph-6').scrollIntoViewIfNeeded()
  await expect(page.getByText('Reading position saved', { exact: true })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Resume reading', exact: true }).click()
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(1000)
  await page.getByRole('button', { name: 'Switch to Arabic' }).click()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
  await expect(page.locator('article[lang="en"]')).toHaveAttribute('dir', 'ltr')
})

test('reader can submit a private report and receives confirmation', async ({ page, request }) => {
  const user = await account(request)
  const id = await article(request, user.token)
  await signIn(page, user.token)
  await page.goto(`/articles/${id}`)
  await page.getByRole('button', { name: 'Report this essay' }).click()
  await page
    .getByRole('textbox', { name: 'Details (optional)' })
    .fill('Please review the attribution of this essay.')
  await page.getByRole('button', { name: 'Submit report', exact: true }).click()
  await expect(page.getByText('Your report has been recorded.', { exact: false })).toBeVisible()
})

test('document autosaves without losing focus or edits typed during a save', async ({
  page,
  request,
}) => {
  const user = await account(request)
  await signIn(page, user.token)
  await page.goto('/write')
  let release!: () => void
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  let saving!: () => void
  const started = new Promise<void>((resolve) => {
    saving = resolve
  })
  await page.route('**/api/v1/account/articles', async (route) => {
    if (route.request().method() !== 'POST') {
      return route.continue()
    }
    const response = await route.fetch()
    saving()
    await held
    await route.fulfill({ response })
  })
  await page.getByRole('textbox', { name: 'Essay title' }).fill('A continuous document')
  const first = page.getByRole('textbox', { name: 'Block 1', exact: true })
  await first.fill('The first thought.')
  await started
  await first.fill('The first thought, with a later edit.')
  release()
  await expect(page).toHaveURL(/\/write\/\d+/)
  await expect(first).toHaveValue('The first thought, with a later edit.')
  await expect(first).toBeFocused()
  await first.press('End')
  await first.press('Enter')
  const second = page.getByRole('textbox', { name: 'Block 2', exact: true })
  await expect(second).toBeFocused()
  await second.fill('A second paragraph.')
  await second.press('End')
  await second.press('Enter')
  await expect(page.getByRole('textbox', { name: 'Block 3', exact: true })).toBeFocused()
  await page.screenshot({ path: test.info().outputPath('document-editor.png') })
  await expect(page.locator('.editor-toolbar output')).toHaveText('Saved')
  await page.reload()
  await expect(first).toHaveValue('The first thought, with a later edit.')
  await expect(second).toHaveValue('A second paragraph.')
  await second.press('Home')
  await second.press('Backspace')
  await expect(second).toHaveCount(0)
  await expect(first).toHaveValue('The first thought, with a later edit.A second paragraph.')
})

test('writer attaches a source inline and previews it in the document', async ({
  page,
  request,
}) => {
  const user = await account(request)
  await signIn(page, user.token)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/write')
  const resource = {
    id: 123,
    url: 'https://example.com/essay',
    kind: 'article',
    processingStatus: 'ready',
    title: 'The original idea',
    displayPolicy: 'metadata',
    description: 'A short source preview.',
    playback: null,
  }
  await page.route('**/api/v1/account/resources', (route) =>
    route.fulfill({ json: { data: resource } }),
  )
  await page.route('**/api/v1/account/resources/123', (route) =>
    route.fulfill({ json: { data: resource } }),
  )
  await page
    .getByRole('textbox', { name: 'Block 1', exact: true })
    .fill('An idea with a reference.')
  await page.getByRole('button', { name: 'Add a source', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'Block 1', exact: true })).toBeVisible()
  await page.getByRole('textbox', { name: 'Source URL' }).fill(resource.url)
  await page.getByRole('button', { name: 'Fetch source' }).click()
  await page
    .getByRole('textbox', { name: 'Why this source matters (optional)' })
    .fill('This supports the opening thought.')
  await page.getByRole('button', { name: 'Add to paragraph' }).click()
  await page.getByRole('button', { name: 'Preview', exact: true }).click()
  await page.getByRole('button', { name: 'Source 1', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'The original idea' })).toBeVisible()
  await expect(page.getByText('This supports the opening thought.')).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('mobile-preview.png') })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
})

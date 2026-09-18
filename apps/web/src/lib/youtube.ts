let ready: Promise<typeof YT> | undefined
export function loadYouTube(): Promise<typeof YT> {
  if (window.YT?.Player) {
    return Promise.resolve(window.YT)
  }
  if (ready) {
    return ready
  }
  ready = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    const timeout = window.setTimeout(() => {
      ready = undefined
      script.remove()
      reject(new Error('YouTube did not respond'))
    }, 15000)
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timeout)
      resolve(window.YT)
    }
    script.src = 'https://www.youtube.com/iframe_api'
    script.onerror = () => {
      clearTimeout(timeout)
      ready = undefined
      script.remove()
      reject(new Error('YouTube could not load'))
    }
    document.head.append(script)
  })
  return ready
}
declare global {
  interface Window {
    YT: typeof YT
    onYouTubeIframeAPIReady: () => void
  }
}

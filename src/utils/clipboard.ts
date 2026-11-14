export async function copyText(
  text: string,
  fallbackElement?: HTMLTextAreaElement | HTMLElement | null,
): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // クリップボードAPIが使えない場合は選択と従来のコピーを試す。
  }
  const temporary = !fallbackElement
  const element = fallbackElement ?? document.createElement('textarea')
  if (temporary) {
    if (element instanceof HTMLTextAreaElement) element.value = text
    element.style.position = 'fixed'
    element.style.opacity = '0'
    document.body.append(element)
  }
  element.focus()
  if (element instanceof HTMLTextAreaElement) element.select()
  else {
    const range = document.createRange()
    range.selectNodeContents(element)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  }
  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    if (temporary) element.remove()
  }
}

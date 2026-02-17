declare module 'qrcode' {
  interface QRCodeOptions {
    width?: number
    margin?: number
    color?: {
      dark?: string
      light?: string
    }
  }

  function toDataURL(text: string, options?: QRCodeOptions): Promise<string>
  function toCanvas(canvas: HTMLCanvasElement, text: string, options?: QRCodeOptions): Promise<void>
  // biome-ignore lint/suspicious/noShadowRestrictedNames: matches qrcode library API
  function toString(text: string, options?: QRCodeOptions): Promise<string>

  export { toDataURL, toCanvas, toString }
  export default { toDataURL, toCanvas, toString }
}

declare module 'ffmpeg-static' {
  /** Absolute path to the bundled ffmpeg binary, or `null` on unsupported platforms. */
  const ffmpegPath: string | null
  export default ffmpegPath
}

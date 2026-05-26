/**
 * Embed Windows exe icon without winCodeSign (avoids symlink privilege errors on 7z extract).
 * Runs after pack, before NSIS — shortcuts and taskbar read icon from the exe.
 */
const path = require('path')
const { existsSync } = require('fs')

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return

  const iconPath = path.join(context.packager.projectDir, 'resources', 'icon.ico')
  if (!existsSync(iconPath)) {
    console.warn('[afterPack] resources/icon.ico missing — skip exe icon')
    return
  }

  const exePath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.exe`
  )

  const rcedit = require('rcedit')
  await rcedit(exePath, { icon: iconPath })
  console.log('[afterPack] Applied icon:', exePath)
}

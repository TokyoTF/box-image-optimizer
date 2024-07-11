import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { basename, extname, join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/logo.png?asset'
import { copyFileSync, readdirSync, renameSync, statSync } from 'fs'
import compress_image from 'compress-images'

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 980,
    height: 520,
    minWidth: 980,
    minHeight: 520,
    show: false,
    resizable: false,
    icon: icon,
    //titleBarStyle: 'hidden',
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  let SelectFolder = ''

  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('Start:Optimizer', (event, args) => {
    if (args.ofiles.length && SelectFolder) {
      args.ofiles.map((v, i) => {
        if (v.checked) {
          setTimeout(
            () => {
              let name = basename(v.realpath)
              let extnames = extname(v.realpath).replace('.', '')
              let ext = name.replace(extname(v.realpath), '')
              if (args.compress) {
                compress_image(
                  v.realpath.replace(/\\/g, '/'),
                  SelectFolder[0].replace(/\\/g, '/') + '/',
                  { compress_force: args.forcereplace, statistic: true, autoupdate: true },
                  false,
                  {
                    jpg: {
                      engine: 'mozjpeg',
                      command: ['-quality', args.perCompress ? args.perCompress : '60']
                    }
                  },
                  {
                    png: {
                      engine: 'pngquant',
                      command: [
                        '--quality=' + args.perCompress ? args.perCompress : '20' + '-100',
                        '-o'
                      ]
                    }
                  },
                  { svg: { engine: 'svgo', command: '--multipass' } },
                  { gif: { engine: 'gifsicle', command: ['--colors', '64', '--use-col=web'] } },
                  function (error, completed) {
                    console.log(completed)

                    if (completed) {
                      renameSync(
                        SelectFolder[0].replace(/\\/g, '/') + '/' + name,
                        SelectFolder[0].replace(/\\/g, '/') + '/' + ext + '.' + v.extchange
                      )
                      console.log(
                        SelectFolder[0].replace(/\\/g, '/') + '/' + name,
                        SelectFolder[0].replace(/\\/g, '/') + '/' + ext + '.' + v.extchange
                      )
                      v.compress = true
                      event.reply('Sync:process', v)
                    }
                    console.log(error)
                  }
                )
              } else if (args.convert && v.extchange != extnames && !args.compress) {
                if (!args.compress) {
                  copyFileSync(
                    v.realpath.replace(/\\/g, '/'),
                    SelectFolder[0].replace(/\\/g, '/') + '/' + ext + '.' + v.extchange
                  )
                  v.compress = true
                  event.reply('Sync:process', v)
                }
                console.log(
                  SelectFolder[0].replace(/\\/g, '/') + '/' + name,
                  SelectFolder[0].replace(/\\/g, '/') + '/' + ext + '.' + v.extchange
                )

                console.log('complete convert')
              }
              //console.log(args.forcereplace)
              //console.log(args.ofiles.length, i + 1)
              if (args.ofiles.length == i + 1) {
                console.log('finished', true)
                event.reply('Sync:process:finished')
              }
            },
            3000 * (v.checked ? i : 0)
          )
        }
      })
    }
  })

  ipcMain.on('Select:Folder', (event) => {
    try {
      const typeOpen = dialog.showOpenDialogSync({
        properties: ['openDirectory']
      })
      if (typeOpen) {
        SelectFolder = typeOpen
        event.reply('Select:Folder', typeOpen)
      } else {
        console.log('select canceled')
      }
    } catch (error) {
      console.log(error)
    }
  })

  ipcMain.on('Open:Folder:async', (event, args) => {
    const newFiles = []
    try {
      const typeOpen = dialog.showOpenDialogSync({
        properties: [
          args == 'singlefile' ? 'openFile' : args == 'folder' ? 'openDirectory' : 'openDirectory',
          'multiSelections'
        ],
        filters: [
          {
            name: '.png, .jpg, .webp, .jpeg, .gif',
            extensions: ['png', 'jpg', 'webp', 'jpeg', 'gif']
          }
        ]
      })
      if (typeOpen.length) {
        for (let index = 0; index < typeOpen.length; index++) {
          const ListSel = typeOpen[index]
          const files = args == 'folder' ? readdirSync(ListSel) : ''
          if (args == 'folder') {
            for (let index = 0; index < files.length; index++) {
              const file = files[index]
              if (
                (!statSync(ListSel + '/' + file).isDirectory() && extname(file) == '.png') ||
                extname(file) == '.jpg' ||
                extname(file) == '.webp' ||
                extname(file) == '.gif' ||
                extname(file) == '.jpeg'
              ) {
                newFiles.push({
                  name: file.replace(extname(file), ''),
                  ext: extname(file).replace('.', '').toLowerCase(),
                  realpath: ListSel + '/' + file,
                  size: statSync(ListSel + '/' + file).size,
                  extchange: extname(file).replace('.', '').toLowerCase(),
                  compress: false,
                  checked: true
                })
              }
            }
          } else if (args == 'singlefile') {
            const name = basename(ListSel)
            newFiles.push({
              name: name.replace(extname(name), ''),
              ext: extname(name).replace('.', '').toLowerCase(),
              realpath: ListSel,
              size: statSync(ListSel).size,
              extchange: extname(name).replace('.', '').toLowerCase(),
              compress: false,
              checked: true
            })
          }
        }
      }
      event.reply('Open:Folder:async', newFiles)
    } catch (error) {
      console.error(error)
    }
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

'use strict'

import { app, protocol, BrowserWindow, ipcMain } from 'electron'
import { createProtocol } from 'vue-cli-plugin-electron-builder/lib'
import installExtension, { VUEJS3_DEVTOOLS } from 'electron-devtools-installer'
import log from '@/utils/log.js'
import logReader from '@/utils/logReader'
import s7client from '@/lib/s7client'
import tcpp from 'tcp-ping'
import constant from '@/lib/constant'
import mysql from '@/lib/mysql'
import electron from 'electron'

mysql.connect()


// log.initialize({ preload: true });
const isDevelopment = process.env.NODE_ENV !== 'production'

const connectPLC = function () {
  s7client.ConnectTo('10.69.156.101').then(res => {
    PLCInfo.plcConnetStatus = res
  }).catch(err => {
    PLCInfo.plcConnetStatus = err
  })
  // log.info(1)
}
connectPLC()

// 传递render页面 plc数据
var PLCInfo = {
  plcConnetStatus: s7client.plcConnetStatus,
}
ipcMain.on('plc-msg', function (event, ...arg) {
  let result = {
    success: true,
    msg: null,
    value: null
  }
  log.info('plc-msg:' + arg)
  switch (arg[0]) {
    case 'getPLCInfo':
      event.sender.send('getPLCInfo-reply', PLCInfo)
      break;
    case 'reconnectPLC':
      // s7client.ConnectTo('192.168.2.1')
      connectPLC()
      event.sender.send('getPLCInfo-reply', PLCInfo)
      break;
  }
})

ipcMain.handle('plc-msg-invoke', async (event, ...arg) => {
  let result = {
    success: null,
    msg: null,
    value: null
  }
  log.info('plc-msg-invoke:' + JSON.stringify(arg))
  switch (arg[0]) {
    case 'read':
      try {
        await s7client.read(arg[1]).then(res => {
          result.success = true
          result.value = res
          log.info(result)
        }).catch(err => {
          result.success = false
          result.value = err
        })
      } catch (err) {
        log.error(err)
        result.success = false
        result.value = err
      }
      // await s7client.read(arg[1]).then(res => {
      //   result.success = true
      //   result.value = res
      //   log.info(result)
      // }).catch(err => {
      //   result.success = false
      //   result.value = err
      // })
      break;
    case 'write':
      await s7client.write(arg[1], arg[2]).then(res => {
        result.success = true
        result.value = res
        // event.sender.send(arg[1].reply, result)
      }).catch(err => {
        result.success = false
        result.value = err
        // event.sender.send(arg[1].reply, result)
      })
      break;
  }
  if (!result.success) {
    log.info('plc try to reconnect times: ' + s7client.tryTimes)
  }
  return result
})

ipcMain.handle('mysql-msg-invoke', async (event, ...arg) => {
  let result = {
    success: true,
    msg: null,
    value: null
  }
  log.info('mysql-msg-invoke:' + arg)
  switch (arg[0]) {
    case constant.mysql.insertBarcd:
      log.info(JSON.parse(arg[1]))
      await mysql.insertBarcd(JSON.parse(arg[1])).then(res => {
        result.msg = 'insert ' + arg[1] + ' success';
        result.value = res
      }).catch(err => {
        result.success = false
        result.msg = err
      })
      break;
    case constant.mysql.searchBarcdList:
      await mysql.searchBarcdList(JSON.parse(arg[1])).then(res => {
        result.success = true
        result.value = res
      }).catch(err => {
        result.msg = err
        result.success = false
        log.error('数据库异常' + err)
      })
      break;
  }
  return result
})

//获取数据库数据
ipcMain.on('mysql-msg', function (event, ...arg) {
  let result = {
    success: true,
    msg: null
  }
  log.info('mysql-msg:' + arg)
  switch (arg[0]) {
    case 'querySysConfig':
      mysql.querySysConfig().then(res => {
        event.sender.send('querySysConfig-reply', res)
      }).catch(err => {
        log.error(err)
      })
      break;
    case 'updateSysConfig':
      mysql.updateSysConfig(arg[1]).then(res => {
        event.sender.send('updateSysConfig-reply', res)
      }).catch(err => {
        log.error(err)
      })
      break;
    case 'queryBarcdList':
      mysql.queryBarcdList().then(res => {
        event.sender.send('queryBarcdList-reply', res)
      }).catch(err => {
        log.error(err)
      })
      break;
    case 'queryReadyBarcdList':
      mysql.queryReadyBarcdList().then(res => {
        event.sender.send('queryReadyBarcdList-reply', res)
      }).catch(err => {
        log.error(err)
      })
      break;
    case 'queryPkgNumberList':
      mysql.queryPkgNumberList().then(res => {
        event.sender.send('queryPkgNumberList-reply', res)
      }).catch(err => {
        log.error(err)
      })
      break;
    // case 'updateBarcdValidStatus':
    //   //传入参数不能以,[]分割,会被转义成array,只能拿到第一个入参参数
    //   mysql.updateBarcdValidStatus(JSON.parse(arg[1])).then(res => {
    //     // event.sender.send('updateBarcdValidStatus-reply', res)
    //   }).catch(err => {
    //     event.sender.send('updateBarcdValidStatus-reply', '数据库异常')
    //     log.error('数据库异常' + err)
    //   })
    //   break;
    case 'deleteBarcd':
      //传入参数不能以,[]分割,会被转义成array,只能拿到第一个入参参数
      mysql.updateBarcdDeleteStatus(JSON.parse(arg[1])).then(res => {
        result.msg = '删除成功'
        event.sender.send('deleteBarcd-reply', result)
      }).catch(err => {
        result.msg = '删除工单失败'
        result.success = false
        event.sender.send('deleteBarcd-reply', result)
        log.error('数据库异常' + err)
      })
      break;
    case 'deletePkgNumber':
      //传入参数不能以,[]分割,会被转义成array,只能拿到第一个入参参数
      mysql.updatePkgNumberDeleteStatus(JSON.parse(arg[1])).then(res => {
        result.msg = '删除成功'
        event.sender.send('deletePkgNumber-reply', result)
      }).catch(err => {
        result.msg = '删除集成码失败'
        result.success = false
        event.sender.send('deletePkgNumber-reply', result)
        log.error('数据库异常' + err)
      })
      break;
    case 'updateBarcdPkgStatus':
      //传入参数不能以,[]分割,会被转义成array,只能拿到第一个入参参数
      mysql.updateBarcdPkgStatus(JSON.parse(arg[1])).then(res => {
        result.msg = '集成码入库成功'
        event.sender.send('updateBarcdPkgStatus-reply', result)
      }).catch(err => {
        result.msg = '集成码插入数据库失败'
        result.success = false
        event.sender.send('updateBarcdPkgStatus-reply', result)
        log.error('数据库异常' + err)
      })
      break;
    case 'deleteAllBarcd':
      mysql.deleteAllBarcd().then(res => {
        result.msg = '删除成功'
        event.sender.send('deleteAllBarcd-reply', result)
      }).catch(err => {
        result.msg = '删除失败'
        result.success = false
        event.sender.send('deleteAllBarcd-reply', result)
        log.error('数据库异常' + err)
      })
      break;
    case constant.mysql.searchBarcdList:
      mysql.searchBarcdList(JSON.parse(arg[1])).then(res => {
        result.success = true
        result.msg = res
        event.sender.send(constant.mysql.searchBarcdList_reply, result)
      }).catch(err => {
        result.msg = err
        result.success = false
        event.sender.send(constant.mysql.searchBarcdList_reply, result)
        log.error('数据库异常' + err)
      })
      break;
    case constant.mysql.queryAllUser:
      mysql.queryAllUser().then(res => {
        result.success = true
        result.msg = res
        event.sender.send(constant.mysql.queryAllUser_reply, result)
      }).catch(err => {
        result.msg = err
        result.success = false
        event.sender.send(constant.mysql.queryAllUser_reply, result)
        log.error('数据库异常' + err)
      })
      break;
    case constant.mysql.updateUser:
      mysql.updateUser(JSON.parse(arg[1])).then(res => {
        result.success = true
        result.msg = res
        event.sender.send(constant.mysql.updateUser_reply, result)
      }).catch(err => {
        result.msg = err
        result.success = false
        event.sender.send(constant.mysql.updateUser_reply, result)
        log.error('数据库异常' + err)
      })
      break;
    case constant.mysql.queryByUser:
      mysql.queryByUser(JSON.parse(arg[1])).then(res => {
        result.success = true
        result.msg = res
        event.sender.send(constant.mysql.queryByUser_reply, result)
      }).catch(err => {
        result.msg = err
        result.success = false
        event.sender.send(constant.mysql.queryByUser_reply, result)
        log.error('数据库异常' + err)
      })
      break;
    case constant.mysql.insertBarcd:
      mysql.insertBarcd([arg[1]]).then(res => {
        result.success = true
        result.msg = res
        event.sender.send(constant.mysql.insertBarcd_reply, result)
      }).catch(err => {
        result.msg = err
        result.success = false
        event.sender.send(constant.mysql.insertBarcd_reply, result)
        log.error('数据库异常' + err)
      })
      break;
    case constant.mysql.insertAlarm:
      mysql.insertAlarm(JSON.parse(arg[1])).then(res => {
        result.success = true
        result.value = res
      }).catch(err => {
        result.msg = err
        result.success = false
        log.error('数据库异常' + err)
      })
      break;
  }
})

//日志数据
ipcMain.on('logFile-msg', function (event, ...arg) {
  log.info('logFile-msg:' + arg)
  switch (arg[0]) {
    case 'getLogFileList':
      logReader.getLogFileList(app.getPath('userData') + '/electron_log/app/').then(res => {
        event.sender.send('getLogFileList-reply', res)
      }).catch(err => {
        event.sender.send('getLogFileList-reply', err)
      })
      break;
    case 'readFile':
      logReader.readFile(app.getPath('userData') + '/electron_log/app/' + arg[1]).then(res => {
        event.sender.send('readFile-reply', res)
      }).catch(err => {
        event.sender.send('readFile-reply', err)
      })
      break;
  }
})

// 系统告警数据
ipcMain.on('sysInfo-msg', function (event, ...arg) {

})

// 渲染进程获取ip 端口状态
ipcMain.on('checkIPPort-msg', function (event, arg) {
  checkTCPCOnnect().then(res => {
    event.sender.send('getIPPort-reply', { tcp: res })
  })
  checkPLCCOnnect().then(res => {
    event.sender.send('getIPPort-reply', { plc: res })
  })
})

log.info("userData: " + app.getPath('userData'))

// 获取系统数据检测地址是否能ping通
const checkTCPCOnnect = function () {
  return new Promise((resolve) => {
    mysql.querySysConfig().then(res => {
      let sysConfig = JSON.parse(res)[0]
      tcpp.probe(sysConfig.PrintIP, sysConfig.PrintPort, function (err, available) {
        resolve(available)
      });
    })
  })
}
const checkPLCCOnnect = function () {
  return new Promise((resolve) => {
    tcpp.ping({ address: '192.168.2.1', timeout: 2000, attempts: 1 }, function (err, data) {
      resolve(data.results[0].err.toString().indexOf('timeout') == -1)
    })
  })
}


// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true } }
])

const Menu = electron.Menu
async function createWindow() {
  Menu.setApplicationMenu(null)
  // Create the browser window.
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      autoHideMenuBar: true,
      webSecurity: false,
      // Use pluginOptions.nodeIntegration, leave this alone
      // See nklayman.github.io/vue-cli-plugin-electron-builder/guide/security.html#node-integration for more info
      nodeIntegration: process.env.ELECTRON_NODE_INTEGRATION,
      contextIsolation: !process.env.ELECTRON_NODE_INTEGRATION
    }
  })

  if (process.env.WEBPACK_DEV_SERVER_URL) {
    // Load the url of the dev server if in development mode
    await win.loadURL(process.env.WEBPACK_DEV_SERVER_URL)
    if (!process.env.IS_TEST) win.webContents.openDevTools()
  } else {
    createProtocol('app')
    // Load the index.html when not in development
    win.loadURL('app://./index.html', {
      hash: '/login'
    })
  }

  win.on('close', function () {
    log.info('quit')
    win.destroy()
  })
}

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  } else {
    app.quit()
  }
})

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async () => {
  if (isDevelopment && !process.env.IS_TEST) {
    // Install Vue Devtools
    try {
      await installExtension(VUEJS3_DEVTOOLS)
    } catch (e) {
      console.error('Vue Devtools failed to install:', e.toString())
    }
  }
  createWindow()
})

// Exit cleanly on request from parent process in development mode.
if (isDevelopment) {
  if (process.platform === 'win32') {
    process.on('message', (data) => {
      if (data === 'graceful-exit') {
        app.quit()
      }
    })
  } else {
    process.on('SIGTERM', () => {
      app.quit()
    })
  }
}

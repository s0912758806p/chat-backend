// import express, ws, uuid
const express = require('express');
const SocketServer = require('ws').Server;

//指定開啟的port
const PORT = 3000;

const server = express().listen(PORT, () => {
	console.log(`開始監聽${PORT}`);
});

const wss = new SocketServer({ server });

// 存放客戶訊息
let clientArr = [];

/**
 * server廣播
 * @param {type} - 類型
 * @param {nickname} - 暱稱
 * @param {message} - 訊息
 * @param {clientCount} - 客戶端個數
 */
function wsSend({ type, clientId, nickname, message, clientCount, avatarId }) {
	// 曆遍客戶端
	wss.clients.forEach((clients) => {
		// 處理客戶端發送的訊息
		clients.send(
			JSON.stringify({
				type: type,
				clientId: clientId,
				nickname: nickname,
				message: message,
        clientCount: clientCount,
        avatarId: avatarId
			})
		);
	});
}

/**
 * 取得客户端id
 */
function getClients(data) {
	let clientIdArr = []
	clientIdArr.push(data.clientId)
	return clientIdArr
}

/**
 * 客户端连接判断
 */
function checkClientId(data) {
	let result = ''
	let clientsId = getClients(data)

	let existUser = clientArr.find((e)=> e.clientId === data.clientId)
	let joinId = clientsId.find((e) => e === data.clientId)

	if ((existUser && existUser.clientId) === joinId) {
		result = 'kick'
	} else {
		result = 'join'
	}

	return result
}

/**
 * 进入聊天室
 */
function joinChatroom(data) {
  let connectMessage = '進入聊天室';

  // 將新連接的客戶端 push 到 clientArr 裡
  clientArr.push({
    clientId: data.clientId,
    ws: data,
    nickname: data.nickname
  });

	// 伺服器廣播
	wsSend({
		type: 'join',
		clientId: data.clientId,
		nickname: data.nickname,
		message: connectMessage,
    clientCount: clientArr.length,
    avatarId: data.avatarId
	});
}

// 伺服器連接
wss.on('connection', (ws) => {

	let nickname = ''
	let clientId = ''

	// 當用戶發送訊息時
	ws.on('message', (msg) => {

		data = JSON.parse(msg)
		// console.log(data)

		nickname = data.nickname
    clientId = data.clientId
    avatarId = data.avatarId

		if(data.type === 'join') {
			let joinOrKick = checkClientId(data)

			if (joinOrKick === 'join') {
				joinChatroom(data)
			}else {
        let serverData = {
          type: joinOrKick,
          message: '使用者名稱已重複',
          clientCount: 0
        }

        ws.send(JSON.stringify(serverData))
      }
		}

		// 用戶輸入'/changenickname' 為重新命名
		if (data.message.startsWith('/changenickname')) {
			let oldNickname = nickname;
			let newNickname = data.message.substr(16);

			if (oldNickname !== newNickname) {
				nickname = newNickname;

				let nicknameMessage = `用户${oldNickname}改名為${nickname}`;

				wsSend({
					type: 'nicknameUpdate',
					clientId: clientId,
					nickname: nickname,
					message: nicknameMessage,
					clientCount: clientArr.length
        });
        
        let serverData = {
          type: 'mineNicknameUpdate',
					nickname: nickname,
          clientCount: clientArr.length,
          avatarId: avatarId
        }

        ws.send(JSON.stringify(serverData))
			}
		} else if (data.type === 'message'){
			wsSend({
				type: 'message',
				clientId: clientId,
				nickname: nickname,
				message: data.message,
        clientCount: clientArr.length,
        avatarId: avatarId
			});
		}
	});

	// 關閉 socket 連接時, 執行函式
	let closeSocket = (customMsg) => {
		// 曆遍客戶端
		for (let i = 0; i < clientArr.length; i++) {
			// 如果用戶存在才執行判斷
			if (clientArr[i].clientId === clientId) {
				// 宣告離開訊息
				let disconnectMsg;

				if (customMsg) {
					disconnectMsg = customMsg;
				} else {
					disconnectMsg = `${nickname}離開聊天室`;
				}

				// 將客戶端陣列中刪除
				clientArr.splice(i, 1);

				// 伺服器廣播
				wsSend({
					type: 'notification',
					clientId: clientId,
					message: disconnectMsg,
					clientCount: clientArr.length
				});
			}
		}
	};

	ws.on('close', () => {
		closeSocket();
	});

	process.on('SIGINT', () => {
		console.log('伺服器關閉');

		closeSocket('伺服器已經關閉');

		setTimeout(()=> {
			process.exit();
		},1000)
	});
});

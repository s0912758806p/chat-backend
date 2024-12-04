import express from 'express';
import { Server as SocketServer, WebSocket } from 'ws';

// 指定開啟的 port
const PORT = 3000;

const server = express().listen(PORT, () => {
  console.log(`開始監聽 ${PORT}`);
});

const wss = new SocketServer({ server });

// 存放客戶訊息
interface Client {
  clientId: string;
  ws: WebSocket;
  nickname: string;
  avatarId: string;
}

let clientArr: Client[] = [];

/**
 * server廣播
 * @param {type} - 類型
 * @param {clientId} - 客戶端ID
 * @param {nickname} - 暱稱
 * @param {message} - 訊息
 * @param {clientCount} - 客戶端個數
 * @param {avatarId} - 头像ID
 */
function wsSend({
  type,
  clientId,
  nickname,
  message,
  clientCount,
  avatarId,
}: {
  type: string;
  clientId: string;
  nickname: string;
  message: string;
  clientCount: number;
  avatarId: string;
}): void {
  // 遍歷客戶端
  wss.clients.forEach((clients) => {
    // 處理客戶端發送的訊息
    if (clients.readyState === WebSocket.OPEN) {
      clients.send(
        JSON.stringify({
          type,
          clientId,
          nickname,
          message,
          clientCount,
          avatarId,
        })
      );
    }
  });
}

/**
 * 取得客户端id
 */
function getClients(data: { clientId: string }): string[] {
  let clientIdArr: string[] = [];
  clientIdArr.push(data.clientId);
  return clientIdArr;
}

/**
 * 客户端连接判断
 */
function checkClientId(data: { clientId: string }): string {
  let result = '';
  let clientsId = getClients(data);

  let existUser = clientArr.find((e) => e.clientId === data.clientId);
  let joinId = clientsId.find((e) => e === data.clientId);

  if (existUser && existUser.clientId === joinId) {
    result = 'kick';
  } else {
    result = 'join';
  }

  return result;
}

/**
 * 進入聊天室
 */
function joinChatroom(data: Client): void {
  let connectMessage = '進入聊天室';

  // 將新連接的客戶端 push 到 clientArr 裡
  clientArr.push({
    clientId: data.clientId,
    ws: data.ws,
    nickname: data.nickname,
    avatarId: data.avatarId,
  });

  // 伺服器廣播
  wsSend({
    type: 'join',
    clientId: data.clientId,
    nickname: data.nickname,
    message: connectMessage,
    clientCount: clientArr.length,
    avatarId: data.avatarId,
  });
}

// 伺服器連接
wss.on('connection', (ws: WebSocket) => {
  let nickname = '';
  let clientId = '';
  let avatarId = '';

  // 當用戶發送訊息時
  ws.on('message', (msg: string) => {
    const data = JSON.parse(msg);

    nickname = data.nickname;
    clientId = data.clientId;
    avatarId = data.avatarId;

    if (data.type === 'join') {
      let joinOrKick = checkClientId(data);

      if (joinOrKick === 'join') {
        joinChatroom(data);
      } else {
        let serverData = {
          type: joinOrKick,
          message: '使用者名稱已重複',
          clientCount: 0,
        };

        ws.send(JSON.stringify(serverData));
      }
    }

    // 用戶輸入 '/changenickname' 為重新命名
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
          clientCount: clientArr.length,
          avatarId: avatarId,
        });

        let serverData = {
          type: 'mineNicknameUpdate',
          nickname: nickname,
          clientCount: clientArr.length,
          avatarId: avatarId,
        };

        ws.send(JSON.stringify(serverData));
      }
    } else if (data.type === 'message') {
      wsSend({
        type: 'message',
        clientId: clientId,
        nickname: nickname,
        message: data.message,
        clientCount: clientArr.length,
        avatarId: avatarId,
      });
    }
  });

  // 關閉 socket 連接時，執行函式
  let closeSocket = (customMsg?: string) => {
    // 遍歷客戶端
    for (let i = 0; i < clientArr.length; i++) {
      // 如果用戶存在才執行判斷
      if (clientArr[i].clientId === clientId) {
        // 宣告離開訊息
        let disconnectMsg = customMsg ? customMsg : `${nickname}離開聊天室`;

        // 將客戶端陣列中刪除
        clientArr.splice(i, 1);

        // 伺服器廣播
        wsSend({
          type: 'notification',
		  nickname: '',
          clientId: clientId,
          message: disconnectMsg,
          clientCount: clientArr.length,
          avatarId: avatarId,
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

    setTimeout(() => {
      process.exit();
    }, 1000);
  });
});

let msg = document.getElementById('msg');
let log = document.getElementById('log');

let slideOpen = false;

function slideToggle() {
  let chat = document.getElementById('chat-content');
  if (slideOpen) {
    chat.style.display = 'none';
    slideOpen = false;
  } else {
    chat.style.display = 'block';
    document.getElementById('chat-alert').style.display = 'none';
    document.getElementById('msg').focus();
    slideOpen = true;
  }
}

function appendLog(item) {
  let docScroll = log.scrollTop > log.scrollHeight - log.clientHeight - 1;
  log.appendChild(item);
  if (docScroll) {
    log.scrollTop = log.scrollHeight - log.clientHeight;
  }
}

function currentTime() {
  let date = new Date();
  let hour = date.getHours();
  let minute = date.getMinutes();
  if (hour < 10) {
    hour = '0' + hour;
  }
  if (minute < 10) {
    minute = '0' + minute;
  }
  return hour + ':' + minute;
}

document.getElementById('form').onsubmit = function () {
  if (!chatWs) {
    return false;
  }
  if (!msg.value) {
    return false;
  }
  chatWs.send(msg.value);
  msg.value = '';
  return false;
};

function connectChat() {
  chatWs = new WebSocket(ChatWebsocketAddr);

  chatWs.onclose = function () {
    console.log('websocket has closed');
    document.getElementById('chat-button').disabled = true;
    setTimeout(() => {
      connectChat();
    }, 1000);
  };

  chatWs.onmessage = function (evt) {
    var messages = evt.data.split('\n');
    if (slideOpen == false) {
      document.getElementById('chat-alert').style.display = 'block';
    }
    for (let i = 0; i < messages.length; ++i) {
      let item = document.getElementById('div');
      item.innerText = currentTime() + ' - ' + messages[i];
      appendLog(item);
    }
  };

  chatWs.onerror = function (evt) {
    console.log('error: ' + evt.data);
  };

  setTimeout(function () {
    if (chatWs.readyState === WebSocket.OPEN) {
      document.getElementById('chat-button').disabled = false;
    }
  }, 1000);
}

connectChat();

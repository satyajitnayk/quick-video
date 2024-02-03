let localStream, remoteStream, peerConnection, ws;

const videosContainer = document.querySelector('.videos');
const localVideo = document.querySelector('.local-video');
const startButton = document.querySelector('.start-button');
const endButton = document.querySelector('.end-button');
const roomIdHeader = document.querySelector('.roomId-header');

// WebSocket endpoint URL
const wsEndpoint = 'ws://localhost:8080/ws';

class Event {
  constructor(type, payload) {
    this.type = type;
    this.payload = payload;
  }
}

class SendMessageEvent {
  constructor(message, from) {
    this.message = message;
    this.from = from;
  }
}

class ReceiveMessageEvent {
  constructor(message, from, sent) {
    this.message = message;
    this.from = from;
    this.sent = sent;
  }
}

class ChangeChtRoomEvent {
  constructor(name) {
    this.name = name;
  }
}

const EventTypes = {
  RECEIVE_MESSAGE: 'receive_message',
  SEND_MESSAGE: 'send_message',
  CHANGE_CHATROOM: 'change_chatroom',
};

// TODO
function changeChatRoom() {}

// Connect to WebSocket server
function connectToWebSocket(roomId) {
  ws = new WebSocket(`${wsEndpoint}?roomID=${roomId}`);

  ws.onopen = () => {
    console.log('WebSocket connected');
  };

  ws.onmessage = async (event) => {
    const message = JSON.parse(event.data);
    if (message.type == 'offer') {
      await handleOffer(message.offer);
    } else if (message.type == 'candidate') {
      handleCandidate(message.candidate);
    }
  };
}

function routeEvent(event) {
  if (!event.type) {
    alert('no type field in the event');
  }

  switch (event.type) {
    case EventTypes.RECEIVE_MESSAGE:
      const messageEvent = Object.assign(
        new ReceiveMessageEvent(),
        event.payload
      );
      appendChatMessage(messageEvent);
      break;

    default:
      alert('unsupported message type');
      break;
  }
}

function appendChatMessage(messageEvent) {
  const date = new Date(messageEvent.sent);
  const formattedMsg = `${messageEvent.from} \n${date.toLocaleString()}: ${
    messageEvent.message
  }`;

  const textarea = document.getElementById('chatmessages');
  // append new msg to text area
  textarea.innerHTML = textarea.innerHTML + '\n' + formattedMsg;
  // scroll to height
  textarea.scrollTop = textarea.scrollHeight;
}

function sendMessage() {
  let newMessage = document.getElementById('message');
  if (newMessage) {
    // TODO: pick username from client side
    let outgoingEvent = new SendMessageEvent(newmessage.value, 'user1');
    sendEvent('send_message', outgoingEvent);
  }
  return false;
}

function sendEvent(eventName, payload) {
  const event = new Event(eventName, payload);

  ws.send(JSON.stringify(event));
}

// Handle received offer
async function handleOffer(offer) {
  try {
    await peerConnection.setRemoteDescription(offer);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    // Send answer to backend via WebSocket
    ws.send(JSON.stringify({ type: 'answer', answer }));
  } catch (error) {
    console.error('Error handling offer:', error);
  }
}

// Handle received ICE candidate
function handleCandidate(candidate) {
  try {
    peerConnection.addIceCandidate(candidate);
  } catch (error) {
    console.error('Error adding ICE candidate:', error);
  }
}

// Start call
startButton.addEventListener('click', async () => {
  const roomId = prompt('Enter room ID:');
  if (roomId) {
    roomIdHeader.innerHTML = roomId;
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localVideo.srcObject = localStream;

      connectToWebSocket(roomId);

      peerConnection = new RTCPeerConnection();
      localStream
        .getTracks()
        .forEach((track) => peerConnection.addTrack(track, localStream));

      // Handle incoming tracks
      peerConnection.ontrack = (event) => {
        console.log('Incoming remote tracks');
        const remoteVideoContainer = document.createElement('div');
        remoteVideoContainer.classList.add('remote-video'); // Add a class for styling

        const remoteVideo = document.createElement('video');
        remoteStream = event.streams[0];
        remoteVideo.srcObject = remoteStream;
        remoteVideo.autoplay = true;

        remoteVideoContainer.appendChild(remoteVideo);
        videosContainer.appendChild(remoteVideoContainer);
      };

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      // send offer to backend using websocket
      ws.send(JSON.stringify({ type: 'offer', offer }));
    } catch (error) {
      console.error('Error accessing media devices or creating offer:', error);
    }
  }
});

// End call
endButton.addEventListener('click', () => {
  if (localStream) {
    stopStreamTracks(localStream);
  }

  if (localStream.srcObject) {
    stopStreamTracks(localVideo.srcObject);
    localVideo.srcObject = null;
  }

  if (remoteStream) {
    stopStreamTracks(remoteStream);
  }

  if (peerConnection) {
    peerConnection.close();
  }

  if (ws) {
    ws.close();
  }

  // Clear all remote video streams from the container
  const remoteVideos = document.querySelectorAll('.remote-video');
  remoteVideos.forEach((video) => video.remove());

  roomIdHeader.innerHTML = '';
});

function stopStreamTracks(stream) {
  if (stream) {
    console.log(stream.getTracks());
    stream.getTracks().forEach((track) => track.stop());
  }
}

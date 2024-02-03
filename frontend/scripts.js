let localStream, remoteStream, peerConnection, ws, remoteVideo;

const videosContainer = document.querySelector('.videos');
const localVideo = document.querySelector('.local-video');
const startButton = document.querySelector('.start-button');
const endButton = document.querySelector('.end-button');
const roomIdHeader = document.querySelector('.roomId-header');

// WebSocket endpoint URL
const wsEndpoint = `ws://${document.location.host}/ws`;

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
  SIGNAL_OFFER: 'offer',
  SIGNAL_ANSWER: 'answer',
  SIGNAL_CANDIDATE: 'candidate',
};

// TODO
function changeChatRoom() {}

// Connect to WebSocket server
function connectToWebSocket(roomId) {
  ws = new WebSocket(`${wsEndpoint}?roomID=${roomId}`);

  ws.onopen = () => {
    console.log('WebSocket connected');
  };

  ws.onerror = (error) => {
    console.error('WebSocket connection failed:', error);
    alert('WebSocket connection failed. Please try again.');
  };

  ws.onmessage = async (event) => {
    console.log('Received WebSocket message:', event.data);
    try {
      const message = JSON.parse(event.data);
      if (message.type == 'offer') {
        console.log('Received offer:', message.offer);
        await handleOffer(message.offer);
      } else if (message.type == 'candidate') {
        console.log('Received ICE candidate:', message.candidate);
        handleCandidate(message.candidate);
      } else {
        console.log('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
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
    let outgoingEvent = new SendMessageEvent(newMessage.value, 'user1');
    sendEvent(EventTypes.SEND_MESSAGE, outgoingEvent);
  }
  return false;
}

// Send event to backend via WebSocket
function sendEvent(eventName, payload) {
  const event = new Event(eventName, payload);
  ws.send(JSON.stringify(event));
}

// Handle received offer
async function handleOffer(offer) {
  try {
    const rtcOffer = new RTCSessionDescription(offer);
    console.log('rtcoffer', rtcOffer);

    await peerConnection.setRemoteDescription(rtcOffer);

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    sendEvent(EventTypes.SIGNAL_ANSWER, {
      answer: peerConnection.localDescription,
    });
  } catch (error) {
    console.error('Error handling offer:', error);
  }
}

// Handle received ICE candidate
function handleCandidate(candidate) {
  try {
    const rtcCandidate = new RTCIceCandidate(candidate);
    peerConnection.addIceCandidate(rtcCandidate);
  } catch (error) {
    console.error('Error adding ICE candidate:', error);
  }
}

// Set up media devices
async function setupMediaDevices() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    localVideo.srcObject = localStream;
  } catch (error) {
    console.error('Error accessing media devices:', error);
  }
}

async function startVideoCall() {
  try {
    const configuration = {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    };
    const peerConnection = new RTCPeerConnection(configuration);

    // Add local stream to peer connection
    localStream
      .getTracks()
      .forEach((track) => peerConnection.addTrack(track, localStream));

    // Handle remote tracks
    peerConnection.ontrack = function (event) {
      if (!remoteStream) {
        remoteStream = new MediaStream();
        remoteVideo.srcObject = remoteStream;
      }
      remoteStream.addTrack(event.track);
    };

    // Create offer
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    // Set up offer to send to the other peer
    peerConnection.onicecandidate = function (event) {
      if (event.candidate) {
        sendEvent('candidate', { candidate: event.candidate });
      }
    };

    console.log('offer descripition', peerConnection.localDescription);
    // send offer to backend using websocket
    sendEvent(EventTypes.SIGNAL_OFFER, {
      offer: peerConnection.localDescription,
    });
  } catch (error) {
    console.error('Error creating video call:', error);
  }
}

function stopStreamTracks(stream) {
  if (stream) {
    console.log(stream.getTracks());
    stream.getTracks().forEach((track) => track.stop());
  }
}

window.onload = function () {
  // Start call
  startButton.addEventListener('click', async () => {
    const roomId = prompt('Enter room ID:');
    if (roomId) {
      roomIdHeader.innerHTML = roomId;
      try {
        connectToWebSocket(roomId);

        ws.onopen = async () => {
          try {
            await setupMediaDevices();
            await startVideoCall();
          } catch (error) {
            console.error(
              'Error accessing media devices or creating offer:',
              error
            );
          }
        };
      } catch (error) {
        console.error('WebSocket connection failed:', error);
        alert('WebSocket connection failed. Please try again.');
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
    remoteVideo.srcObject = null;
    roomIdHeader.innerHTML = '';
  });
};

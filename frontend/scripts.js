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
    try {
      const parsedEvent = Object.assign(new Event(), JSON.parse(event.data));

      await routeEvent(parsedEvent);
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  };
}

async function routeEvent(event) {
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

    case EventTypes.SIGNAL_OFFER:
      await handleOffer(event.payload);
      break;
    case EventTypes.SIGNAL_CANDIDATE:
      handleCandidate(event.payload);
      break;
    case EventTypes.SIGNAL_ANSWER:
      await handleAnswer(event.payload);
      break;
    default:
      alert('unsupported event type', event.type);
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

// Handle received answer
async function handleAnswer(answer) {
  try {
    const rtcAnswer = new RTCSessionDescription(answer);
    await peerConnection.setRemoteDescription(rtcAnswer);
  } catch (error) {
    console.error('Error handling answer:', error);
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
    peerConnection = new RTCPeerConnection(configuration);

    // Add local stream to peer connection
    if (localStream) {
      localStream
        .getTracks()
        .forEach((track) => peerConnection.addTrack(track, localStream));
    }

    // Set to keep track of added remote tracks
    let addedRemoteTracks = new Set();

    // Handle remote tracks
    peerConnection.ontrack = function (event) {
      console.log('remote stream', event.streams[0]);
      console.log('local stream', localStream);
      if (event.streams[0] !== localStream) {
        if (!remoteStream) {
          remoteStream = new MediaStream();
          if (remoteVideo) {
            remoteVideo.srcObject = remoteStream;
          }
        }
        // Check if the track has not been added before
        if (!addedRemoteTracks.has(event.track.id)) {
          // Add the received track to the remote stream
          remoteStream.addTrack(event.track);

          // Add the track to the set of added remote tracks
          addedRemoteTracks.add(event.track.id);

          // Create a new video element for each remote stream
          const newVideoContainer = document.createElement('div');
          newVideoContainer.className = 'video-conatiner';

          const newRemoteVideo = document.createElement('video');
          newRemoteVideo.className = 'remote-video';
          newRemoteVideo.autoplay = true;

          // Attach the remote stream to the new video element
          newRemoteVideo.srcObject = event.streams[0];
          newVideoContainer.appendChild(newRemoteVideo);

          videosContainer.appendChild(newVideoContainer);
        }
      }
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

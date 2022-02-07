// @ts-nocheck

export default class SymblHandler{
    
    webSockets = {}
    player_connection = null
    meetingid=null 
    accessToken=null
    name=""
    uid=""
    cc_on=false
    _captions = {}
    _captions_id = []
    _conversation_id=""

    constructor(meetingid,name, uid){
        this.meetingid=meetingid;
        this.name = name
        this.uid = uid
    }



    async configure(){
        const rawResponse = await fetch('https://api.symbl.ai/oauth2/token:generate', {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                type: "application",
                appId: "3972456f4d68655a793641696136796f476f37653958376b6c47724235787979",
                appSecret: "6f522d784d412d61474f3538587150376564372d337a533859664a53727a55504770396c43424a6c587875616f5037487166535330315945723233766b657944"
            })
          });
        let res_json = await rawResponse.json();
        this.accessToken = res_json['accessToken']
        let time_out = res_json['expiresIn'] 
        setTimeout(()=>{
            this.configure()
        },time_out*1000)
    }

    connect(uid){
        let _meeting_id = btoa(this.meetingid+"_"+uid.toString());
        let ws_endpoint = `wss://api.symbl.ai/v1/realtime/insights/${_meeting_id}?access_token=${this.accessToken}`
        let ws = new WebSocket(ws_endpoint);
        this.webSockets[uid]={}
        this.webSockets[uid]['ws'] = ws;

        ws.onerror  = (err) => {
            console.error(err);
        };
          
        ws.onclose = (event) => {
            console.info(`Symblai: Connection to websocket closed for uid:${uid}. Trying to reconnect....`);
            if(this.webSockets.hasOwnProperty(uid)){
                this.connect(uid)
            }
        };
        
        ws.onopen = (event) => {
            ws.send(JSON.stringify({
              type: 'start_request',
              meetingTitle: `MeetVerse: meetingId: ${this.meetingid}`, // Conversation name
              insightTypes: ['question', 'action_item'], // Will enable insight generation
              config: {
                confidenceThreshold: 0.5,
                languageCode: 'en-US',
                speechRecognition: {
                  encoding: 'LINEAR16',
                  sampleRateHertz: 44100,
                }
              },
              speaker: {
                userId: `${this.uid}@${this.meetingid}`,
                name: this.name
              }
            }));
          };
    }

    disconnect(uid){
        if(this.webSockets.hasOwnProperty(uid)){
            let ws = this.webSockets[uid]['ws']
            delete this.webSockets[uid]
            try{
              ws.send(JSON.stringify({
                "type": "stop_request"
              }));
            }catch(e){
              ws.close()
            }
        }
    }

    makeid(length) {
      var result           = '';
      var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      var charactersLength = characters.length;
      for ( var i = 0; i < length; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
     }
      return result;
    }

    render_cc(){
      let a= "";
      for(let x of this._captions_id){
        a+=this._captions[x]+"<br>"
      }
      if(this.cc_on && a!=""){
        $("#cc_layer").children().html(a)
        $("#cc_layer").css("display", "flex");
      }else{
        $("#cc_layer").hide()
      }
    }
  

    playerConnection(){
        let _meeting_id = btoa(this.meetingid+"_"+this.uid.toString());
        let ws_endpoint = `wss://api.symbl.ai/v1/realtime/insights/${_meeting_id}?access_token=${this.accessToken}`
        let ws = new WebSocket(ws_endpoint);
        this.webSockets[this.uid]={}
        this.webSockets[this.uid]['ws'] = ws;

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'message' && data.message.hasOwnProperty('data')) {
              console.log('conversationId', data.message.data.conversationId);
              this._conversation_id = data.message.data.conversationId
            }
            if (data.type === 'message_response') {
              for (let message of data.messages) {
                //`<span class="cc_caller">${message['from']['name']}:</span>`
                //last_name = message['from']['name']
                //last_uid = message['from']['userId']
                if(this._captions.hasOwnProperty(message['from']['userId'])){
                  let index = this._captions_id.indexOf(message['from']['userId']);
                  if (index !== -1) {
                    this._captions_id.splice(index, 1);
                  }
                  delete this._captions[message['from']['userId']]
                }
                let _temp_id = message['from']['userId']+this.makeid(4)
                this._captions[_temp_id] = `<span class="cc_caller">${message['from']['name']}: </span>${message.payload.content}`
                this._captions_id.push(_temp_id)
                
                setTimeout(()=>{
                  let index = this._captions_id.indexOf(_temp_id);
                  if (index !== -1) {
                    this._captions_id.splice(index, 1);
                  }
                  delete this._captions[_temp_id]
                  this.render_cc()
                },4000);
               
                console.log('Transcript (more accurate): ', message.payload.content);
              }
            }
            if (data.type === 'topic_response') {
              for (let topic of data.topics) {
                console.log('Topic detected: ', topic.phrases)
              }
            }
            if (data.type === 'insight_response') {
              for (let insight of data.insights) {
                console.log('Insight detected: ', insight.payload.content);
              }
            }
            if (data.type === 'message' && data.message.hasOwnProperty('punctuated')) {
              console.log('Live transcript (less accurate): ', data.message.punctuated.transcript)
              this._captions[data.message['user']['userId']] = `<span class="cc_caller">${data.message['user']['name']}: </span>${data.message.punctuated.transcript}`;
              let index = this._captions_id.indexOf(data.message['user']['userId']);
              if (index !== -1) {
                this._captions_id.splice(index, 1);
              }
              this._captions_id.push(data.message['user']['userId'])
            }
            console.log(`Response type: ${data.type}. Object: `, data);
            this.render_cc()
          };
          
          ws.onerror  = (err) => {
            console.error(err);
          };
          
          ws.onclose = (event) => {
            console.info(`Symblai: Connection to websocket closed for player. Trying to reconnect....`);
            this.playerConnection()
          };
          
          ws.onopen = (event) => {
            ws.send(JSON.stringify({
              type: 'start_request',
              meetingTitle: `MeetVerse: meetingId: ${this.meetingid}`, // Conversation name
              insightTypes: ['question', 'action_item'], // Will enable insight generation
              config: {
                confidenceThreshold: 0.5,
                languageCode: 'en-US',
                speechRecognition: {
                  encoding: 'LINEAR16',
                  sampleRateHertz: 44100,
                }
              },
              speaker: {
                userId: `${this.uid}@${this.meetingid}`,
                name: 'Me'
              }
            }));
          };
    }

    leave(){
        for(let _ws in this.webSockets){
            try{
                let ws = this.webSockets[_ws]['ws']
                delete this.webSockets[_ws]
                ws.send(JSON.stringify({
                    "type": "stop_request"
                }));
            }catch(e){

            }

        }
    }

    async gotoSymblInsights(){
      const res = await fetch(`https://api.symbl.ai/v1/conversations/${this._conversation_id}/experiences`, {
        method: "post",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.accessToken,
        },
        mode: "cors",
        body: JSON.stringify({
          name: "verbose-text-summary"
        })
      });
      const data = await res.json();
      window.open(data.url, '_blank').focus();
    }

    handleSuccess = (stream) => {
        const AudioContext = window.AudioContext;
        const context = new AudioContext();
        const source = context.createMediaStreamSource(stream);
        const processor = context.createScriptProcessor(1024, 1, 1);
        const gainNode = context.createGain();
        source.connect(gainNode);
        gainNode.connect(processor);
        processor.connect(context.destination);
        processor.onaudioprocess = (e) => {
          // convert to 16-bit payload
          const inputData = e.inputBuffer.getChannelData(0) || new Float32Array(8192);
          const targetBuffer = new Int16Array(inputData.length);
          for (let index = inputData.length; index > 0; index--) {
              targetBuffer[index] = 32767 * Math.min(1, inputData[index]);
          }
          // Send audio stream to websocket.
          for(let _ws in this.webSockets){
            let ws= this.webSockets[_ws]['ws']
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(targetBuffer.buffer);
              }
            }
        };
      };
      
    
}
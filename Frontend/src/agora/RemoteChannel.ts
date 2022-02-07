// @ts-nocheck

export  default class RemoteChannel{
    agoradID="c868a38007fb4e2e87c7d65ea3177117"
    channels = {}
    async join(channel_name){
        if(!this.channels.hasOwnProperty(channel_name)){
            let client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
            this.channels[channel_name] = client;
            client.on("user-published", async (user, mediaType) => {
                await client.subscribe(user, mediaType);
                console.log("subscribe success");
                if (mediaType === "audio") {
                    const remoteAudioTrack = user.audioTrack;
                    remoteAudioTrack.play();
                }
                client.on("user-unpublished", async user => {
                    await client.unsubscribe(user);
                });
        
            });
            client.join(this.agoradID, channel_name, null, null);
        }
    } 

    async leave(channel_name){
        if(this.channels.hasOwnProperty(channel_name)){
            let client = this.channels[channel_name];
            delete this.channels[channel_name]
            await client.leave();
        }
    }

    async setLevel(){

    }
}
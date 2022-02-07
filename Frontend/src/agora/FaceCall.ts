// @ts-nocheck

export default class FaceCall{

    client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
    agoraToken="f07df2b85dc04996b8be8072117dd5a0"; //your agora token

 
    localVideoTrack=null
    
    scene = null
    avatars={}
    _fact_text =null

    constructor(scene){
        this.scene = scene
    }   

    async joinChannel(channel_name, uid){
        let client = this.client;
        await client.join(this.agoraToken,channel_name,null,uid.toString());
        //client.setClientRole('host')
        client.on("user-published", async (user, mediaType) => {
            // Subscribe to a remote user.
            await client.subscribe(user, mediaType);
            console.log("subscribe success");
            // If the subscribed track is audio.
            
            if (mediaType === "video") {
                let uid = user.uid.toString()
                let remotePlayerContainer = document.createElement("div");
                remotePlayerContainer.id = uid+"_cam";
                remotePlayerContainer.style.display = "none";
                document.body.append(remotePlayerContainer);

                const remoteVideoTrack = user.videoTrack;
                remoteVideoTrack.play(remotePlayerContainer);

                let videoElement = $( `#${uid}_cam` ).find( "video" )[0]
                if(this.avatars.hasOwnProperty(uid)){
                    let mat :BABYLON.PBRMaterial = this.avatars[uid]['avatar'].getChildMeshes()[4].material
                    mat.albedoTexture = new BABYLON.VideoTexture(`video-${uid}`, videoElement, this.scene, true);
                }else{
                    this.avatars[uid]={}
                    this.avatars[uid]['video_el'] = videoElement
                }
            }

        });
        
        client.on("user-unpublished", user => {
            let uid = user.uid.toString()
            if(this.avatars.hasOwnProperty(uid) && this.avatars[uid].hasOwnProperty('avatar')){
                console.log(this._fact_text)
                let mat :BABYLON.PBRMaterial = this.avatars[uid]['avatar'].getChildMeshes()[4].material;
                mat.albedoTexture = this._fact_text;
            }

            let playerContainer = document.getElementById(`${uid}_cam`);
            if(playerContainer!=null){
                playerContainer.remove();
            }
        });
    }

    addRemoteAvatar(_avatar, uid, _fact_text){
        this._fact_text = _fact_text;
        uid = uid.toString()
        if(this.avatars.hasOwnProperty(uid) && this.avatars[uid].hasOwnProperty('video_el')){
            this.avatars[uid]['avatar'] = _avatar;
            let mat :BABYLON.PBRMaterial = this.avatars[uid]['avatar'].getChildMeshes()[4].material
            mat.albedoTexture = new BABYLON.VideoTexture(`video-${uid}`,  this.avatars[uid]['video_el'], this.scene, true);
        }else{
            this.avatars[uid]={}
            this.avatars[uid]['avatar'] = _avatar;
        }
    }

    removeRemoteAvatar(uid){
        uid = uid.toString()
        delete this.avatars[uid]
    }

    async leaveChannel(){
        $("#videoc").attr("src", "icons/videooff.png")
        await this.stop_cam();
        await (this.client).leave();
    }


    async stop_cam(){
        if(this.localVideoTrack!=null){
            this.localVideoTrack.close();
            this.localVideoTrack=null;
        }

        try{
            $( `#${this.client.uid.toString()}_cam` ).remove();
        }catch(e){
            console.log("hetansh: stop_cam error"+e)
        }
        this.client.unpublish();
    }


    async start_cam(){
        console.log("hetansh: enable cam")
        try{
            console.log("hetansh: starting cam")
            if(this.localVideoTrack!=null){
                return;
            }
            let localVideoTrack = await AgoraRTC.createCameraVideoTrack();

          
            if(localVideoTrack!=null){
                let PlayerContainer = document.createElement("div");
                PlayerContainer.id = this.client.uid.toString()+"_cam";
                PlayerContainer.style.display = "none";
                document.body.append(PlayerContainer);
                
                localVideoTrack.play(PlayerContainer);
                this.localVideoTrack = localVideoTrack;
                let videoElement = $( `#${this.client.uid.toString()}_cam` ).find( "video" )[0]
                this.client.publish([this.localVideoTrack]);
                return videoElement;
            }
        }catch(e){
            console.log("hetansh: video share error:"+e)
        }
        return null;
    }   
}
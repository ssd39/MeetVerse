// @ts-nocheck
import * as idelcv from '../IdleCanvas'

export default class PresentationHelper{

    client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
    agoraToken="f07df2b85dc04996b8be8072117dd5a0"; //your agora token

    localAudioTrack=null
    localVideoTrack=null
    remoteAudioTrack =null
    remoteVideoTrack=null
    scene = null
    videoElement =null
    canvas=null

    constructor(scene,canvas){
        this.scene = scene
        this.canvas = canvas
    }   

    async joinChannel(channel_name){
        let client = this.client;
        await client.join(this.agoraToken,channel_name,null,null);
        //client.setClientRole('host')
        client.on("user-published", async (user, mediaType) => {
            // Subscribe to a remote user.
            await client.subscribe(user, mediaType);
            console.log("subscribe success");
            // If the subscribed track is audio.
            
            await this.stop_presentation();

            if (mediaType === "video") {
                try{
                    this.videoElement=null;
                    if(this.remoteVideoTrack!=null){
                        this.remoteVideoTrack.stop();
                        this.remoteVideoTrack=null;
                    }
               
                }catch(e){
                    console.log(e)
                }

                let remotePlayerContainer = document.createElement("div");
                remotePlayerContainer.id = user.uid.toString();
                remotePlayerContainer.style.display = "none";
                document.body.append(remotePlayerContainer);

                const remoteVideoTrack = user.videoTrack;
                remoteVideoTrack.play(remotePlayerContainer);
                this.remoteVideoTrack = remoteVideoTrack;

                this.videoElement = $( `#${user.uid.toString()}` ).find( "video" )[0]
                let mat : BABYLON.StandardMaterial = this.scene.getMaterialByName('screen_material_0')
                mat.diffuseTexture = new BABYLON.VideoTexture("screen_share",   this.videoElement , this.scene, false);
                idelcv.stop()
            }

            if (mediaType === "audio") {

                    if(this.remoteAudioTrack!=null){
                        this.remoteAudioTrack.stop();
                    }
           
                    const remoteAudioTrack = user.audioTrack;
                    remoteAudioTrack.play();
                    this.remoteAudioTrack=remoteAudioTrack;
                
            }
        });
        
        client.on("user-unpublished", user => {
            if(this.remoteVideoTrack!=null && $(`#video_${this.remoteVideoTrack.toString()}`).length==0 && this.localVideoTrack==null){
                
                this.remoteVideoTrack=null;
                this.videoElement=null;

                let mat : BABYLON.StandardMaterial = this.scene.getMaterialByName('screen_material_0')
                mat.diffuseTexture = this.canvas
                idelcv.start(this.canvas.getContext(), this.canvas)
            }

            let playerContainer = document.getElementById(user.uid);
            if(playerContainer!=null){
                playerContainer.remove();
            }
           
        });
    }



    async leaveChannel(){
        await this.stop_presentation();
        await (this.client).leave();
    }

    async start_presentation(){
        console.log("hetansh: I am in create channel")
        await this.enableAudioVideo()
    }


    async stop_presentation(){
        $("#cast").attr("src", "icons/castoff.png")

        if(this.localAudioTrack!=null){
            this.localAudioTrack.close();
            this.localAudioTrack=null;
        }
        if(this.localVideoTrack!=null){
            this.localVideoTrack.close();
            this.localVideoTrack=null;

            let mat : BABYLON.StandardMaterial = this.scene.getMaterialByName('screen_material_0')
            mat.diffuseTexture = this.canvas
            idelcv.start(this.canvas.getContext(), this.canvas)
        }

        try{
            $( `#${this.client.uid.toString()}` ).remove();
        }catch(e){
            console.log("hetansh: stop_presentation error"+e)
        }
        this.client.unpublish();
    }


    async enableAudioVideo(){
        console.log("hetansh: enable audio video")

        await this.stop_presentation();

        try{
            console.log("hetansh: starting screen share")
            let tracks = await AgoraRTC.createScreenVideoTrack({},"auto");
            let localVideoTrack =null
            let localAudioTrack = null
            if(Array.isArray(tracks)){
                if(tracks.length>1){
                    localAudioTrack = tracks[1]
                }
                localVideoTrack = tracks[0]
            }else{
                localVideoTrack = tracks
            }
          
            if(localVideoTrack!=null){
                this.videoElement = null;
                if(this.remoteVideoTrack!=null){
                    this.remoteVideoTrack.stop();
                    this.remoteVideoTrack=null;
                }
                let remotePlayerContainer = document.createElement("div");
                remotePlayerContainer.id = this.client.uid.toString();
                remotePlayerContainer.style.display = "none";
                document.body.append(remotePlayerContainer);
                
                localVideoTrack.play(remotePlayerContainer);
                this.localVideoTrack = localVideoTrack;
                this.videoElement = $( `#${this.client.uid.toString()}` ).find( "video" )[0]

                let mat : BABYLON.StandardMaterial = this.scene.getMaterialByName('screen_material_0')
                mat.diffuseTexture = new BABYLON.VideoTexture("screen_share",   this.videoElement , this.scene, false);
                idelcv.stop()
                if(localAudioTrack!=null){
                    this.localAudioTrack =localAudioTrack
                    this.client.publish([this.localVideoTrack,this.localAudioTrack]);
                }else{
                    this.client.publish([this.localVideoTrack]);
                }
                $("#cast").attr("src", "icons/cast.png");
            }
        }catch(e){
            console.log("hetansh: video share error:"+e)
        }
    }   
}
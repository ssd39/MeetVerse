// @ts-nocheck
import * as BABYLON from 'babylonjs';
import "babylonjs-loaders";
import {
    CharacterController
} from './CharacterController'
import LocalChannel from './agora/LocalChannel';
import {
    RemoteCharacterController
} from './RemoteCharacterController';
import {
    PBRMaterial
} from 'babylonjs/Materials/PBR/pbrMaterial';
import * as idelcv from './IdleCanvas'
import PresentationHelper from './agora/PresentationHelper';
import FaceCall from './agora/FaceCall';
import { BaseTexture } from 'babylonjs/Materials/Textures/baseTexture';
import SymbolHandler from './SymblAi/SymblHandler';

var Buffer = require('buffer').Buffer
var ieee754 = require('ieee754')

export default class MyScene {
    private _canvas: HTMLCanvasElement;
    private _engine: BABYLON.Engine;
    private _scene: BABYLON.Scene;
    private _camera: BABYLON.ArcRotateCamera;
    private _player: BABYLON.AbstractMesh;
    private _cc: CharacterController;
    private _playerList = {};
    private _ws = null;
    private _join_status = false;
    private _roomId = ""
    private _rcolor = {}
    private _color: BABYLON.Color3 = new BABYLON.Color3(0, 0, 0)
    private mainCanvas = null
    private _myself = ""
    private _presentation_helper : PresentationHelper = null
    private _face_call : FaceCall = null
    private _local_channel: LocalChannel=null
    private _man_face : BaseTexture = null
    private _symbl_ai : SymbolHandler = null

    constructor(canvasElement: string, roomid: string, name: string) {
        // Create canvas and engine.
        this._canvas = document.getElementById(canvasElement) as HTMLCanvasElement;
        this._engine = new BABYLON.Engine(this._canvas, true);
        this._roomId =  roomid;
        this._myself = name;
    }

    addVideoNode = (id, stream) => {
        let videoNode = document.getElementById('video-' + id);
      
        if (!videoNode) {
          videoNode = document.createElement('video');
      
          videoNode.setAttribute('id', 'video-' + id);
          videoNode.setAttribute('height', 240);
          videoNode.setAttribute('width', 320);
          videoNode.setAttribute("playsinline", true);
          videoNode.muted = true;
          videoNode.setAttribute("autoplay", 'autoplay');
      
          const videoContainer = document.getElementById('virtual_video_screens');
          videoContainer.appendChild(videoNode);
        }
        navigator.attachMediaStream(videoNode, stream);
        return videoNode;
    }

    removeVideoNode = id => {
        let videoNode = document.getElementById("video-" + id)
        if (videoNode) {
            videoNode.srcObject = null; // Prevent memory leak in Chrome
            videoNode.parentNode.removeChild(videoNode)
        }
    }


    async wsClient(callback) {
        console.log("Initialsing Websocket Connection...")
        callback(false, "Joining Room...")
        try {
            this._ws = new WebSocket('wss://meetverse.herokuapp.com/ws');
            this._ws.binaryType = "arraybuffer";
            this._ws.onclose = async () => {

                this._ws = null;
                for (let a in this._playerList) {
                    let p: RemoteCharacterController = this._playerList[a]
                    p._avatar.dispose()
                    delete this._playerList[a]
                    this._face_call.removeRemoteAvatar(a)
                    this._symbl_ai.disconnect(id)
                }
                console.log("Connection closed!")
                console.log("Retrying....")
                setTimeout(() => {
                    console.log("Retrying again after 1s delay...")
                    this.wsClient(callback)
                }, 1000)
            }

            this._ws.onerror = (e) => {
                console.log("Webscoket Error: " + e)
            }

            this._ws.onmessage = async (event) => {
                let data = event.data;
                if (typeof data == "string") {
                    data = JSON.parse(data)
                    if (data.response == "room_joined") {
                        
                        try{
                            if(this._local_channel){
                                await this._local_channel.leaveChannel()   
                            }
                            this._local_channel = new LocalChannel();
                            await this._local_channel.create_channel(this._roomId + data.id)
                        }catch(e){
                            console.error(e)
                        }

                        try{
                            if(this._face_call){
                                await this._face_call.leaveChannel()
                            }
                            this._face_call = new FaceCall(this._scene)
                            await this._face_call.joinChannel(this._roomId+"_cam", data.id)
                        }catch(e){
                            console.error(e)
                        }

                        try{
                            if(this._symbl_ai){
                                this._symbl_ai.leave()   
                            }
                            this._symbl_ai = new SymbolHandler(this._roomId, this._myself, data.id)
                            await this._symbl_ai.configure()
                            this._symbl_ai.playerConnection()
                        }catch(e){
                            console.error('hetansh',e)
                        }
               
                        if (!this._join_status) {

                            this._scene = new BABYLON.Scene(this._engine);
                            callback(false, "Loading Character...")
                            await this.loadPlayer()
                            callback(false, "Loading Scene...")
                            await this.createScene();
                            setInterval(() => {
                                this._ws.send(JSON.stringify({
                                    action: "ping",
                                }))
                            }, 10000)
                            callback(true, "")
                            this._join_status = true;
                          

                        

                            $("#mic").click(() => {
                                if ($("#mic").attr("src") == "icons/mmicrophone.png") {
                                    console.log("unmute")
                                    this._local_channel.unmute(this._symbl_ai.handleSuccess);
                                    this._ws.send(JSON.stringify({
                                        action: "mic_on",
                                    }))
                                    let mat: BABYLON.PBRMaterial = this._player.getChildMeshes()[5].material 
                                    mat.emissiveColor = new BABYLON.Color3(30/255, 230/255, 60/255);
                                    $("#mic").attr("src", "icons/microphone.png");
                                } else {
                                    console.log("mute")
                                    this._local_channel.mute();
                                    this._ws.send(JSON.stringify({
                                        action: "mic_off",
                                    }))
                                    let mat: BABYLON.PBRMaterial = this._player.getChildMeshes()[5].material 
                                    mat.emissiveColor = new BABYLON.Color3(1, 0, 0);
                                    $("#mic").attr("src", "icons/mmicrophone.png")
                                }
                            });
                                 
                            $("#videoc").click(async () => {
                                if ($("#videoc").attr("src") == "icons/videooff.png") {
                                    console.log("cam on")
                                    let vel = await this._face_call.start_cam()
                                    if(vel){
                                        let mat :BABYLON.PBRMaterial = this._player.getChildMeshes()[4].material
                                        mat.albedoTexture = new BABYLON.VideoTexture(`video-self`,vel, this._scene, true);
                                        $("#videoc").attr("src", "icons/video.png");
                                    }
                                    
                                } else {
                                    console.log("cam off")
                                    this._face_call.stop_cam()
                                    let mat :BABYLON.PBRMaterial = this._player.getChildMeshes()[4].material
                                    mat.albedoTexture = this._man_face
                                    $("#videoc").attr("src", "icons/videooff.png")
                                }
                            });
                            $("#cast").click(() => {
                                if ($("#cast").attr("src") == "icons/castoff.png") {
                                    if(document.getElementById("screenshare")){
                                        window.toast('Someone presenting the screen!')
                                        return;
                                    }
                                    $("#cast").attr("src", "icons/cast.png");
                                    this._presentation_helper.start_presentation()

                                } else {
                                    console.log("un-cast")
                                    $("#cast").attr("src", "icons/castoff.png")
                                    this._presentation_helper.stop_presentation()
                                }
                            });
                            $("#fpp").click(() => {
                                if ($("#fpp").attr("src") == "icons/viewoff.png") {
                                    console.log("view on")
                                    this._player.setEnabled(false)
                                    $("#fpp").attr("src", "icons/view.png");
                                } else {
                                    console.log("view off")
                                    this._player.setEnabled(true)
                                    $("#fpp").attr("src", "icons/viewoff.png")
                                }
                            });

                            $("#cc_cap").click(() => {
                                if ($("#cc_cap").attr("src") == "icons/ccoff.png") {
                                    $("#cc_cap").attr("src", "icons/cc.png");
                                    this._symbl_ai.cc_on=true
                                } else {
                                    $("#cc_cap").attr("src", "icons/ccoff.png")
                                    this._symbl_ai.cc_on=false
                                    $('#cc_layer').hide();
                                }
                            });
                            $("#dataa_symbl").click(() => {
                                if(this._symbl_ai){
                                    this._symbl_ai.gotoSymblInsights()
                                }
                            })
                        }
                        
                        
                        if ($("#mic").attr("src") != "icons/mmicrophone.png") {
                            this._ws.send(JSON.stringify({
                                action: "mic_on",
                            }))
                        }
                        this._color = new BABYLON.Color3(data.rgb[0], data.rgb[1], data.rgb[2])
                        let mat: PBRMaterial = this._scene.getMaterialByName("body.001")
                        mat.albedoColor = this._color
                        console.log("Room joined sucessfully...")
                    } else if (data.response == "rgb") {
                        this._rcolor[data.id] = data.rgb
                        if (this._playerList.hasOwnProperty(data.id)) {
                            this._playerList[data.id].setColor(data.rgb)
                        }
                    }else if(data.response == "mic_on"){
                        if (this._playerList.hasOwnProperty(data.id)) {
                            let r : RemoteCharacterController = this._playerList[data.id]
                            let mat: BABYLON.PBRMaterial = r._avatar.getChildMeshes()[5].material 
                            mat.emissiveColor = new BABYLON.Color3(30/255, 230/255, 60/255);
                        }
                    }else if(data.response == "mic_off"){
                        if (this._playerList.hasOwnProperty(data.id)) {
                            let r : RemoteCharacterController = this._playerList[data.id]
                            let mat: BABYLON.PBRMaterial = r._avatar.getChildMeshes()[5].material 
                            mat.emissiveColor = new BABYLON.Color3(1, 0, 0);
                        }
                    }
                } else {
                    let buf = Buffer.from(data)
                    let a = buf[0]
                    let response = ((1 << 2) - 1) & a;
                    let id = (a >> 2);
                    if (response == 1) {

                        if (!this._playerList.hasOwnProperty(id)) {
                            await this.createRemotePlayer(id)
                        }
                        let p: RemoteCharacterController = this._playerList[id]

                        p._avatar.position.x = this.extractFloatPos(buf.slice(1, 4))
                        p._avatar.position.z = this.extractFloatPos(buf.slice(4, 7))
                    } else if (response == 0) {
                        if (this._playerList.hasOwnProperty(id)) {
                            let p: RemoteCharacterController = this._playerList[id]
                            let x = this.extractFloat(buf.slice(1, 3))
                            let y = this.extractFloat(buf.slice(3, 5))
                            let z = this.extractFloat(buf.slice(5, 7))
                            let ang = this.extractFloatAng(buf.slice(7, 10))
                            p.setMoveData(new BABYLON.Vector3(x, y, z))
                            p._avatar.rotation.y = ang;
                        }
                    } else if (response == 3) {
                        if (this._playerList.hasOwnProperty(id)) {
                            let p: RemoteCharacterController = this._playerList[id]
                            p._avatar.dispose()
                            delete this._playerList[id]
                            this._face_call.removeRemoteAvatar(id)
                            this._symbl_ai.disconnect(id)
                        }
                    }


                }
            }

            return new Promise((resolve, reject) => {
                this._ws.onopen = () => {
                    console.log("Websocket Connection Opened!")
                    this._ws.send(JSON.stringify({
                        action: "join",
                        //set it to dynamic
                        room: this._roomId
                    }))
                    resolve();
                };
            });

        } catch (e) {
            console.error(e)
        }
    }


    async createScene() {
        // Create a basic BJS Scene object.

        // Create a FreeCamera, and set its position to (x:0, y:5, z:-10).
        this._camera = new BABYLON.ArcRotateCamera("ArcRotateCamera", (Math.PI / 2 + this._player.rotation.y), Math.PI / 2.5, 5, new BABYLON.Vector3(this._player.position.x, this._player.position.y + 1.5, this._player.position.z), this._scene);

        this._camera.wheelPrecision = 15;
        this._camera.checkCollisions = false;
        //make sure the keyboard keys controlling camera are different from those controlling player
        //here we will not use any keyboard keys to control camera
        this._camera.keysLeft = [];
        this._camera.keysRight = [];
        this._camera.keysUp = [];
        this._camera.keysDown = [];
        //how close can the camera come to player
        this._camera.lowerRadiusLimit = 2;
        //how far can the camera go from the player
        this._camera.upperRadiusLimit = 20;
        this._camera.attachControl(this._canvas, false);

        this.createCC()
        // Create a basic light, aiming 0,1,0 - meaning, to the sky.
        this._light = new BABYLON.HemisphericLight('light1', new BABYLON.Vector3(0, 1, 0), this._scene);

        var skybox = BABYLON.MeshBuilder.CreateBox("skyBox", {
            size: 1000.0
        }, this._scene);
        var skyboxMaterial = new BABYLON.StandardMaterial("skyBox", this._scene);
        skyboxMaterial.backFaceCulling = false;
        skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture("gallexy/", this._scene);
        skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
        skyboxMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
        skyboxMaterial.specularColor = new BABYLON.Color3(0, 0, 0);

        skybox.material = skyboxMaterial;

        var gl = new BABYLON.GlowLayer("glow", this._scene);
        gl.intensity = 0.4;

        new BABYLON.ScreenSpaceReflectionPostProcess("ssr", this._scene, 1.0, this._camera);

        let alpha = 0;
        this._scene.registerBeforeRender(() => {
            skybox.rotation.y = alpha;
            if(this._player.position.y<-10){
                this._player.position.y=0
                this._player.position.x = this.randomPosition(-9.0, 9.0)
                this._player.position.z = this.randomPosition(0.0, 13.0)
            }
            if (this._cc._moveVector && this._cc.anyMovement() && (this._cc._act._walk || this._cc._act._walkback || this._cc._act._stepLeft || this._cc._act._stepRight)) {
                let tmp = this._cc._moveVector
                this._ws.send(Buffer.concat([this.compressFloat(tmp.x), this.compressFloat(tmp.y), this.compressFloat(tmp.z), this.compressFloatAng(this._player.rotation.y % 360)]))

                let buf_list = [this.compressFloatPos(this._player.position.x), this.compressFloatPos(this._player.position.z)]
                this._ws.send(Buffer.concat(buf_list))

            }
            alpha += 0.001;
        });

        await this.loadMeshes()
        this.test()
    }


    startRenderLoop() {
        this._engine.runRenderLoop(() => {
            this._scene.render();
        });
    }

    compressFloat(val) {
        const buf = Buffer.alloc(2)
        ieee754.write(buf, val, 0, true, 15, 2)
        return buf;
    }

    extractFloat(buf) {
        const num = ieee754.read(buf, 0, true, 15, 2)
        return num;
    }

    compressFloatAng(val) {
        const buf = Buffer.alloc(3)
        ieee754.write(buf, val, 0, true, 16, 3)
        return buf;
    }

    extractFloatAng(buf) {
        const num = ieee754.read(buf, 0, true, 16, 3)
        return num;
    }

    extractFloatPos(buf) {
        const num = ieee754.read(buf, 0, true, 16, 3)
        return num;
    }

    compressFloatPos(val) {
        const buf = Buffer.alloc(3)
        ieee754.write(buf, val, 0, true, 16, 3)
        return buf;
    }


    async create_screen(id, position: BABYLON.Vector3, rotation) {
        let videoMat = new BABYLON.StandardMaterial(`screen_material_${id}`, this._scene);
        videoMat.backFaceCulling = false;
        videoMat.specularColor = new BABYLON.Color3(255, 0, 0);
        videoMat.roughness = 1;


        var txt = new BABYLON.DynamicTexture(`canvas_sc`, {
            width: 600,
            height: 400
        }, this._scene);


        let screen = this._scene.getMeshByName('canvas_screen')
        let new_screen = screen.clone(`screen_${id}`);
        new_screen.checkCollisions = false;
        new_screen.position = position;
        new_screen.rotate(new BABYLON.Vector3(0, 1, 0), rotation, 0);
        videoMat.diffuseTexture = txt
        new_screen.material = videoMat
    }

    getRandomInt(max) {
        return Math.floor(Math.random() * max);
    }

    async test() {

        let videoMat = new BABYLON.StandardMaterial("screen_material_0", this._scene);
        videoMat.backFaceCulling = false;
        videoMat.specularColor = new BABYLON.Color3(255, 0, 0);
        videoMat.roughness = 1;

        let screen = this._scene.getMeshByName("canvas_screen")
        screen.checkCollisions = false;
        screen.material = videoMat

        var txt = new BABYLON.DynamicTexture(`canvas_0`, {
            width: 600,
            height: 400
        }, this._scene);
        videoMat.diffuseTexture = txt
        this.mainCanvas = txt

        idelcv.start(this.mainCanvas.getContext(), this.mainCanvas)
        this._presentation_helper  = new PresentationHelper(this._scene, this.mainCanvas);
        this._presentation_helper.joinChannel(this._roomId)

    }



    async createCC() {
        this._cc = new CharacterController(this._player, this._camera, this._scene);
        this._cc.setFaceForward(true);
        this._cc.setMode(0);
        this._cc.setTurnSpeed(45);
        this._cc.setCameraTarget(new BABYLON.Vector3(0, 1.5, 0));
        this._cc.setNoFirstPerson(false);
        this._cc.setStepOffset(0.4);
        this._cc.setSlopeLimit(30, 60);;
        this._cc.start();
    }


    async loadimage(img) {
        img.crossOrigin = "anonymous";
        new Promise((myResolve, myReject) => {
            img.onload = () => {
                myResolve();
            }
        });
    }


    async loadPlayer() {

        let character = await BABYLON.SceneLoader.ImportMeshAsync(null, "", "man.glb", this._scene);
        this._player = character.meshes[0]
        for (let m of character.meshes) {
            console.log(m.name)
            if (m.material) {
                console.log(m.material.name)
            }

            if(m.name=="sarir_primitive4"){
                let mat: PBRMaterial = m.material
                this._man_face = mat.albedoTexture
            }
        }
        let mat: BABYLON.PBRMaterial = this._player.getChildMeshes()[5].material.clone("player_mat1") 
        mat.emissiveColor = new BABYLON.Color3(1, 0, 0);
        this._player.material = mat

        let mat1: BABYLON.PBRMaterial = this._player.getChildMeshes()[4].material.clone("player_mat0") 
        this._player.material = mat1

        this._player.rotation = this._player.rotationQuaternion.toEulerAngles();
        this._player.rotationQuaternion = null;

        //this._player.rotate(new BABYLON.Vector3(0,1,0),Math.PI,0);
        //this._player.position.y=2.1;
        // mat.diffuseTexture = new BABYLON.Texture("https://d5nunyagcicgy.cloudfront.net/external_assets/hero_examples/hair_beach_v391182663/original.jpeg");

        this._player.position.x = this.randomPosition(-9.0, 9.0)
        this._player.position.z = this.randomPosition(0.0, 13.0)
      
        let buf_list = [this.compressFloatPos(this._player.position.x), this.compressFloatPos(this._player.position.z)]
        this._ws.send(Buffer.concat(buf_list))

        this.drawEllipsoid(this._player, "__ellipsoid__", 1, 8, 8, true)

        this._player.checkCollisions = true;
        this._player.ellipsoid = new BABYLON.Vector3(0.5, 1, 0.5);
        this._player.ellipsoidOffset = new BABYLON.Vector3(0, 0.9, 0);
    }

    randomPosition(x, y): Number {
        return Number((Math.random() * (x - y) + y).toFixed(4))
    }

    drawEllipsoid(mesh, name, x, y, z, hide = false) {
        mesh.computeWorldMatrix(true);
        if (hide) {
            var ellipsoidMat = mesh.getScene().getMaterialByName("__ellipsoidMat__h");
            if (!ellipsoidMat) {
                ellipsoidMat = new BABYLON.StandardMaterial("__ellipsoidMat__h", mesh.getScene());
                ellipsoidMat.alpha = 0;
            }
        } else {
            var ellipsoidMat = mesh.getScene().getMaterialByName("__ellipsoidMat__");
            if (!ellipsoidMat) {
                ellipsoidMat = new BABYLON.StandardMaterial("__ellipsoidMat__", mesh.getScene());
                ellipsoidMat.wireframe = true;
                ellipsoidMat.emissiveColor = BABYLON.Color3.Green();
                ellipsoidMat.specularColor = BABYLON.Color3.Black();
            }
        }

        var ellipsoid = BABYLON.Mesh.CreateSphere(name, 9, 1, mesh.getScene());
        ellipsoid.scaling = mesh.ellipsoid.clone();
        ellipsoid.scaling.y *= x;
        ellipsoid.scaling.x *= y;
        ellipsoid.scaling.z *= z;
        ellipsoid.material = ellipsoidMat;
        ellipsoid.parent = mesh;
        ellipsoid.computeWorldMatrix(true);
        return ellipsoid;
    }

    async createRemotePlayer(id) {
        let rp = this._player.clone(`rp_${id}`)

        rp.checkCollisions = false;
        this._player.checkCollisions = false;
        rp.position.y = -1.6;

        rp.ellipsoid = new BABYLON.Vector3(0.5, 1, 0.5);
        rp.ellipsoidOffset = new BABYLON.Vector3(0, 0.9, 0);

        this._playerList[id] = new RemoteCharacterController(rp, this._scene, id, this._roomId, this._symbl_ai);
        if (this._rcolor.hasOwnProperty(id)) {
            this._playerList[id].setColor(this._rcolor[id])
        }
        this._playerList[id].start()
        this._face_call.addRemoteAvatar(this._playerList[id]._avatar, id, this._man_face)

    }


    async loadMeshes() {
        let Icosphere = await BABYLON.SceneLoader.ImportMeshAsync(null, "", "space_gallery.glb", this._scene);
        for (let m of Icosphere.meshes) {
            m.checkCollisions = true;
            if(["Object_27","Object_21","Object_17","Object_23","Object_25","Object_19","Object_33","Object_31","Object_29"].includes(m.name)){
                m.checkCollisions = false; 
            }
           /* if(m.name=="Object_64.003"){
                console.log("hetansh",m.position)
            }*/
        }
        let Icosphere = await BABYLON.SceneLoader.ImportMeshAsync(null, "", "screen.glb", this._scene);
        for (let m of Icosphere.meshes) {
          console.log(m.name)
          m.position.z=-8.8
          m.position.y = 0.85
       
        }
        
        var gl = new BABYLON.GlowLayer("glow_agora", this._scene);
        let Icosphere = await BABYLON.SceneLoader.ImportMeshAsync(null, "", "agora.glb", this._scene);
        for (let m of Icosphere.meshes) {
          console.log(m.name)
          gl.addIncludedOnlyMesh(m)
        }
        gl.intensity = 0.4

        let agora_mesh = Icosphere.meshes[0]
        agora_mesh.position.x =-11
        agora_mesh.position.y = 0.2
        agora_mesh.rotate(new BABYLON.Vector3(0, 1, 0), Math.PI/3, 0)
        agora_mesh.scaling = new BABYLON.Vector3(0.5,0.5,0.5)
        console.log('hetansh',Icosphere.animationGroups)

        for(let anim of  Icosphere.animationGroups){
            anim.start(true, 1.0, anim.from, anim.to, false);
        }

        var gl_s = new BABYLON.GlowLayer("glow_symbl", this._scene);
        let Icosphere = await BABYLON.SceneLoader.ImportMeshAsync(null, "", "symbl.glb", this._scene);
        for (let m of Icosphere.meshes) {
          console.log(m.name)
          gl_s.addIncludedOnlyMesh(m)
        }
        gl_s.intensity = 0.2

        let symbl_mesh = Icosphere.meshes[0]
        symbl_mesh.position.x = 11
        symbl_mesh.position.y = 0.2
        symbl_mesh.rotate(new BABYLON.Vector3(0, 1, 0), -Math.PI/3, 0)
        symbl_mesh.scaling = new BABYLON.Vector3(0.4,0.4,0.4)

        for(let anim of  Icosphere.animationGroups){
            anim.start(true, 1.0, anim.from, anim.to, false);
        }

        
        /*var gl = new BABYLON.GlowLayer("glow_dolby", this._scene);
        let Icosphere = await BABYLON.SceneLoader.ImportMeshAsync(null, "", "dolby.glb", this._scene);
        for (let m of Icosphere.meshes) {
          console.log(m.name)
          gl.addIncludedOnlyMesh(m)
        }
        gl.intensity = 0.2

        let dolby_mesh = Icosphere.meshes[0]
        dolby_mesh.rotate(new BABYLON.Vector3(0, 1, 0), Math.PI, 0);
        dolby_mesh.position._z =16
        dolby_mesh.position._y = 0.3
        let anim1 = Icosphere.animationGroups[1] 
        anim1.start(true, 1.0, anim1.from, anim1.to, false);*/

        /*let Icosphere = await BABYLON.SceneLoader.ImportMeshAsync(null, "", "digital_board.glb", this._scene);
        for (let m of Icosphere.meshes) {
            console.log(m.name)
        }

        var groundWidth = 2;
        var groundHeight = 0.5;

        var ground = BABYLON.MeshBuilder.CreateGround("ground1", {
            width: groundWidth,
            height: groundHeight,
            subdivisions: 25
        }, this._scene);
        var txt = new BABYLON.DynamicTexture(`canvas_brd`, {
            width: 512,
            height: 256
        }, this._scene);
        let bmat: StandardMaterial = new BABYLON.StandardMaterial('ww', this._scene)

        bmat.diffuseTexture = txt
        ground.material = bmat
        this.brdcanvas = txt*/


       /* let pbr_stage0 = new BABYLON.PBRMaterial("pbr", this._scene);
        let pbr_stage1 = new BABYLON.PBRMaterial("pbr", this._scene);

        let stage_mesh_0 = this._scene.getMeshByName("stage_primitive0")
        let stage_mesh_1 = this._scene.getMeshByName("stage_primitive1")
        let cylinder0 = this._scene.getMeshByName("Cylinder_primitive0")

        stage_mesh_0.material = pbr_stage0;
        stage_mesh_1.material = pbr_stage1;

        pbr_stage0.metallic = 1.0;
        pbr_stage0.roughness = 0.2;
        pbr_stage1.metallic = 1.0;
        pbr_stage1.roughness = 0.1;
        pbr_stage0.subSurface.isRefractionEnabled = true;
        pbr_stage1.subSurface.isRefractionEnabled = true;

        var glass = new BABYLON.PBRMaterial("glass", this._scene);

        glass.indexOfRefraction = 0.52;
        glass.alpha = 0.1;
        glass.directIntensity = 0.0;
        glass.environmentIntensity = 0.7;
        glass.cameraExposure = 0.66;
        glass.cameraContrast = 1.66;
        glass.microSurface = 1;
        glass.subSurface.isRefractionEnabled = true;
        glass.reflectivityColor = new BABYLON.Color3(0.2, 0.2, 0.2);
        glass.albedoColor = new BABYLON.Color3(0.95, 0.95, 0.95);
        cylinder0.material = glass;

        var gl = new BABYLON.GlowLayer("glow", this._scene);

        gl.addIncludedOnlyMesh(this._scene.getMeshByName("Cylinder.003"))
        gl.addIncludedOnlyMesh(this._scene.getMeshByName("Cylinder.007"))
        gl.addIncludedOnlyMesh(this._scene.getMeshByName("Cylinder.008"))
        gl.addIncludedOnlyMesh(this._scene.getMeshByName("Cylinder.009"))
        gl.addIncludedOnlyMesh(this._scene.getMeshByName("Cylinder.010"))
        gl.intensity = 0.1;*/

    }

    doRender(): void {
        window.addEventListener('resize', () => {
            this._engine.resize();
        });
    }
}
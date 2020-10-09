require(
    [
      'js/lib/decoupled-input/InputController',
      'js/lib/decoupled-input/MouseHandler',
      'js/lib/decoupled-input/KeyboardHandler',
      'js/lib/decoupled-input/GamepadHandler',
      'js/bindings',
      'js/InfiniteGround',
      'js/Controls',
      'js/terrainGenerator',
      'js/Cannon',
      'js/RadarDetector'
    ],
    function (
      InputController,
      MouseHandler,
      KeyboardHandler,
      GamepadHandler,
      bindings,
      InfiniteGround,
      Controls,
      terrainGenerator,
      Cannon,
      RadarDetector)

{

  // dichiarazione delle variabili
  var camera, scene, renderer,
      audioContext, gunBuffer,
      shipBuffer, shipSource, shipGainNode,
      musicBuffer, musicSource, musicTime = 0,
      lastTime, elapsedTime,
      infiniteGround, controls, input,
      cannon, targets,
      targetsTotal = 10,
      targetsToHit = 10,
      level,
      sun, hud, radar,
      topSpeed = 0,
      meshes,
      tileSize = 256,
      meshSize = tileSize * 20,
      halfMeshSize = meshSize / 2,
      heightMap = 'img/heightmap_2.png',
      elevationLevel = 0.1;

  var SCREEN_HEIGHT = window.innerHeight;
  var SCREEN_WIDTH = window.innerWidth;

  var info = document.getElementById('info'); // riferimento al tag html 'info'

  var isPaused = true;

  // l'evento scatta quando la pagina passa in secondo piano
  document.addEventListener("webkitvisibilitychange", function () {
    if (document.webkitHidden){
      musicTime = audioContext.currentTime;
      musicSource.stop();
      shipSource.stop();
      isPaused || ( input.togglePause = 1 );
    } else {
      musicSource = audioContext.createBufferSource();
      musicSource.buffer = musicBuffer;
      musicSource.loop = true;
      musicSource.connect(audioContext.destination);
      musicSource.start(0, musicTime, musicBuffer.duration - musicTime);
    }
  }, false);


  init();

  function init () {

    var urlLevel = parseInt(getParameterByName('level'));
    level = urlLevel? urlLevel: 1;
    targetsTotal = getTarghtForLevel(level);
    targetsToHit = getTarghtForLevel(level);

    /* creazione della scena */
    scene = new THREE.Scene();

    // Creazione dell effetto nebbia
    scene.fog = new THREE.Fog(0xefd1b5, 0, halfMeshSize);

    //creazione e posizionamento della camera prospettiva
    camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 10000 );
    camera.position.z = 1000;
    camera.far = halfMeshSize;
    camera.position.y = 100;
    scene.add(camera);

    // inizializzazione input handler
    var inputController = new InputController(bindings);
    inputController.registerDeviceHandler(MouseHandler, 'mouse');
    inputController.registerDeviceHandler(KeyboardHandler, 'keyboard');
    inputController.registerDeviceHandler(GamepadHandler, 'gamepad');
    input = inputController.input;

    /* Inizializzazione dei controlli */
    controls = new Controls(camera, inputController.input);

    /* Inizializzazione renderer */
    renderer = new THREE.WebGLRenderer();
    renderer.sortObjects = false;
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.shadowMapEnabled = true;
    renderer.shadowMapSoft = true;
    renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);

    // aggiungiamo una luce ambientale
    scene.add( new THREE.AmbientLight( 0x505050 ) );

    // e una luce direzionale
    sun = new THREE.DirectionalLight(0xffffff, 1);
    //sun = new THREE.SpotLight( 0xffffff, 1.5 );
    sun.position.set( 0, 500, 2000 );
    sun.position.set( 1000, 500, 2000 );
    sun.position.set( camera.position.x + 1000, camera.position.y + 1000, camera.position.z + 1000);
    sun.castShadow = true;

    sun.shadowCameraNear = 0;
    sun.shadowCameraFar = meshSize; //camera.far;
    sun.shadowCameraFov = 50;

    sun.shadowBias = -0.00022;
    sun.shadowDarkness = 0.5;

    sun.shadowMapWidth = 2048;
    sun.shadowMapHeight = 2048;

    sun.target = camera;

    scene.add( sun );

    /* interfacia giocatore */

    hud = {
      horizon: document.getElementById('horizon'),
      speed: document.getElementById('speed'),
      height: document.getElementById('height'),
      thrust: document.getElementById('thrust'),
      targetsLeft: document.getElementById('targetsleft'),
      targetsHit: document.getElementById('targetshit'),
      time: document.getElementById('time'),
      target: document.getElementById('target'),
      targetDistance: document.getElementById('target').getElementsByTagName('span')[0]
    };
    hud.textProperty = typeof hud.time.innerText !== 'undefined' ? 'innerText' : 'textContent';

    /* Audio */
    audioContext = new AudioContext();

    shipGainNode = audioContext.createGain();
    shipGainNode.connect(audioContext.destination);

    // load della risorsa audio laser
    var request = new XMLHttpRequest();
    request.open('GET', 'audio/LaserBlaster.mp3', true);
    request.responseType = 'arraybuffer';

    request.onload = function() {
      audioContext.decodeAudioData(request.response, function(buffer) {
        gunBuffer = buffer;

        /* Cannone laser */
        cannon = new Cannon(camera, scene, input, audioContext, gunBuffer);

        var request = new XMLHttpRequest();
        request.open('GET', 'audio/ship.mp3', true);
        request.responseType = 'arraybuffer';

        request.onload = function() {
        audioContext.decodeAudioData(request.response, function(buffer) {
          shipBuffer = buffer;

          shipSource = audioContext.createBufferSource();
          shipSource.buffer = shipBuffer;
          shipSource.loop = true;
          shipSource.connect(shipGainNode);


          var request = new XMLHttpRequest();
          request.open('GET', 'audio/SoundTrack.mp3', true);
          request.responseType = 'arraybuffer';

          request.onload = function() {
            audioContext.decodeAudioData(request.response, function(buffer) {

              musicBuffer = buffer;

              musicSource = audioContext.createBufferSource();
              musicSource.buffer = buffer;
              musicSource.loop = true;
              musicSource.connect(audioContext.destination);

              musicSource.start(0);

              /* inizzializzazione del terreno */

              var img = new Image();
              img.onload = function () {
                meshes = terrainGenerator.build(img, meshSize, tileSize, elevationLevel, scene);
                onTerrainLoaded();
              };
              img.src = heightMap;
            }, function(){ console.log('ERR:', arguments); } );
          };
          request.send();

        }, function(){ console.log('ERR:', arguments); } );
      };
      request.send();

      }, function(){ console.log('ERR:', arguments); } );
    };
    request.send();


    window.addEventListener('resize', onResize, false);
  }


  // Dopo la creazione del terreno aggiungiamo i nemici
  function onTerrainLoaded () {

    var container = document.getElementById('container');
    container.appendChild(renderer.domElement);
    infiniteGround = new InfiniteGround(camera, meshes, meshSize);

    /* Targets */
    targets = [];
    createTargets();
    cannon.setTargets(targets);

    radar = new RadarDetector(camera);

    elapsedTime = 0;
    lastTime = + new Date();
    animate(lastTime);

    document.documentElement.classList.remove('loading');
  }

  function onResize () {
    SCREEN_HEIGHT = window.innerHeight;
    SCREEN_WIDTH = window.innerWidth;
    renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
    camera.aspect = SCREEN_WIDTH / SCREEN_HEIGHT;
    camera.updateProjectionMatrix();
  }

  function animate(time){

    var delta = time - lastTime;
    lastTime = time;

    requestAnimationFrame(animate);

    render(delta);

  }

  function render (delta) {

    //quando premi P
    if(input.togglePause){
      isPaused = !isPaused;
      input.togglePause = 0;
      document.documentElement.classList[isPaused ? 'add' : 'remove']('paused');

      if(isPaused){
        shipSource.stop();
        return;
      } else {
        shipSource = audioContext.createBufferSource();
        shipSource.buffer = shipBuffer;
        shipSource.loop = true;
        shipSource.connect(shipGainNode);
        shipSource.stop();
      }
    }

    if(isPaused){
      return;
    }


    elapsedTime += delta;

    controls.update(delta);

    infiniteGround.update();

    shipSource.playbackRate.value = 1.0 + ( controls.speed / 20 );
    shipGainNode.gain.value = 0.4 + ( controls.speed / 20 );


    var heightOverGround = camera.position.y - terrainGenerator.getHeightAt(camera.position.x, camera.position.z);
    if(heightOverGround <= 0){
      isPaused = true;
      report('Peccato!</br>La forza sembrava potente in te!');
      shipSource.stop();
      return;
    }

    if(controls.speed > topSpeed){
      topSpeed = controls.speed;
    }

    cannon.update(delta);

    sun.position.set( camera.position.x + 2000, camera.position.y + 2000, camera.position.z + 2000);

    renderer.render(scene, camera);

    // se hai distrutto tutti i nemici hai vinto
    if(targets.length <= ( targetsTotal - targetsToHit )){
      isPaused = true;
      //shipSource.stop();
      report('OMG, hai salvato Jakku!!', true);
      return;
    }


    // trova il nemico piú vicino

    for(var i = 0, m = targets.length; i<m; i++){
      var target = targets[i],
          a = target.position,
          b = camera.position;
      target.distance = Math.sqrt(
        Math.pow(a.x - b.x, 2) +
        Math.pow(a.y - b.y, 2) +
        Math.pow(a.z - b.z, 2)
      );

      // avvicinarsi al nemico ne fa aumentare la velocitá
      var speed = 2000 / target.distance;
      //target.position.x -= speed;
      (i%4 == 0)? target.position.x -= speed : target.position.x += (speed) ;
      (i%2 == 0)? target.position.z -= speed : target.position.z += (speed) ;

      // il nemico mantine una certa altezza dal terreno
      var desiredHeight = terrainGenerator.getHeightAt(target.position.x - speed, target.position.z) + 500;
      var diff = target.position.y - desiredHeight;
      target.position.y -= THREE.Math.clamp(diff, -.2,.2);
    }
    // ordiniamo i nemici dal piu vicino al piú lontano
    targets.sort(function(a, b){ return a.distance > b.distance ? 1 : -1; });

      //il piú vicino sará indicato dalla freccia
    var nearestTarget = targets[0];
    radar.detect(nearestTarget);

    //aggiornamento dei dati visualizzati nell interfaccia
    hud.target.style.left = THREE.Math.clamp(nearestTarget.radarLeft + 50, 5, 95) + '%';
    hud.target.classList[nearestTarget.isInFront ? 'remove' : 'add']('behind');
    hud.targetDistance[hud.textProperty] = ( nearestTarget.distance / 10).toFixed(0);
    hud.height[hud.textProperty] = 'ALTITUDINE: ' + ( camera.position.y / 2 ).toFixed(0);
    hud.speed[hud.textProperty] = 'VELOCITA\': ' + ( controls.speed / 0.02 ).toFixed(0);
    hud.thrust[hud.textProperty] = 'POTENZA MOTORE: ' + ( controls.thrust * 10 ).toFixed(0) + '%';
    hud.time[hud.textProperty] = 'Tempo: ' + ( elapsedTime / 1000 ).toFixed(2);
    hud.targetsLeft[hud.textProperty] = 'Nemici rimasti: ' + ( targets.length - ( targetsTotal - targetsToHit ) );

  }

  //creazione dei nemici
  function createTargets() {
      //var geometry = new THREE.SphereGeometry(20, 16, 12);
      var enemyLoader = new THREE.JSONLoader();

      //caricamento del modello in formato json
      enemyLoader.load('assets/enemy.js',
      function(geometry) {

          for (var i = 0; i < targetsTotal; i++) {

              // creazione del nemico
              var object = new THREE.Mesh(geometry,new THREE.MeshPhongMaterial({color: 0xaaafb7}));
              object.position.x = Math.random() * meshSize - halfMeshSize;
              object.position.z = Math.random() * halfMeshSize - ( i * 500 );
              object.position.y = terrainGenerator.getHeightAt(object.position.x, object.position.z) + 500;
              object.rotation.set(0,1,0);
              object.castShadow = true;
              object.receiveShadow = false;
              object.hitCounter = 0;
              object.isHit = false;
              object.updateMatrix();

              // funzione che viene eseguita al momento della distruzione del nemico
              object.onDestroyed = function () {

                  var ball = this;
                  var audio = new Audio('audio/Bomb.mp3');
                  audio.play();
                  scene.remove(ball);
              }.bind(object);

              targets.push(object);
              scene.add(object);
          }
      });

  }

  // visulizza le statistiche di gioco al termine della partita
  function report(msg, winning) {
    var _elapsed = ( elapsedTime / 1000 );
    var _topspeed = ( topSpeed / 0.02 );
    var targetsHit = targetsTotal - targets.length;
    var _accuracy = targetsHit == 0 ? 0 : ( targetsHit / cannon.bulletsFired ) * 100;
    var node = document.getElementById('report');
    var newLevelUrl =  window.location.href;
    var newLevel = level + 1;
    newLevelUrl = newLevelUrl.substring(0, newLevelUrl.lastIndexOf('=')+1)+(newLevel);

    var score = (
      _accuracy * 100 +
      _topspeed
    ) / _elapsed * 1000;


    node.innerHTML = '<h1>' + msg + '</h1>\
    Tempo trascorso: ' + _elapsed.toFixed(2) + 's<br>\
    Velocità massima: ' + _topspeed.toFixed(2) + '<br>\
    Colpi sparati: ' + cannon.bulletsFired + '<br>\
    Precisione: ' + _accuracy.toFixed(1) + '%<br>\
    <br><br>' + (
      winning ?
      '<strong>Score: ' + score.toFixed(0) + '</strong> </br>'+
          '<a href="'+newLevelUrl+'">Prossimo livello</a>':
      ''
    );

    node.style.display = 'block';
  }

  function getParameterByName(name, url) {
      if (!url) {
          url = window.location.href;
      }
      name = name.replace(/[\[\]]/g, "\\$&");
      var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
          results = regex.exec(url);
      if (!results) return null;
      if (!results[2]) return '';
      return decodeURIComponent(results[2].replace(/\+/g, " "));
  }

  function getTarghtForLevel(level) {
    if (level){
      return level * 3;
    }
    return 3;
  }

});


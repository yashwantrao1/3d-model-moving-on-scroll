// ====================== LENIS + GSAP SETUP ======================
const lenis = new Lenis();
lenis.on("scroll", ScrollTrigger.update);

gsap.ticker.add((time) => {
  lenis.raf(time * 1000);
});
gsap.ticker.lagSmoothing(0);

// ====================== THREE.JS SCENE SETUP ======================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xfefdfd);
const modelsGroup = new THREE.Group();
scene.add(modelsGroup);

// Camera
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 0, 5);
camera.lookAt(0, 0, 0);

// Debug helpers toggle and controls handle
const DEBUG_HELPERS = true;
let controls;

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setClearColor(0xffffff, 1);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.physicallyCorrectLights = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 2.5;

// Append canvas to DOM
document.querySelector(".model").appendChild(renderer.domElement);

// ====================== LIGHTS ======================
scene.add(new THREE.AmbientLight(0xffffff, 3));

const mainLight = new THREE.DirectionalLight(0xffffff, 1);
mainLight.position.set(5, 10, 7.5);
scene.add(mainLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 3);
fillLight.position.set(-5, 0, -5);
scene.add(fillLight);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 2);
hemiLight.position.set(0, 25, 0);
scene.add(hemiLight);

// ====================== GLOBAL VARIABLES ======================
let model;
let model2;
const loader = new THREE.GLTFLoader();

const floatAmplitude = 5;
const floatSpeed = 1.5;
const rotationSpeed = 0.3;
let isFloating = true;
let currentScroll = 0;

const stickyHeight = window.innerHeight;
const scannerSection = document.querySelector(".scanner");
const scannerPosition = scannerSection.offsetTop;
const scanContainer = document.querySelector(".scan-container");
const scanSound = new Audio("./beep.mp3");

// Hide scan container initially
gsap.set(scanContainer, { scale: 0 });

// ====================== LOAD MODEL ======================
loader.load("./water.glb", function (gltf) {
  model = gltf.scene;

  // Set material properties and enable shadows
  model.traverse((node) => {
    if (node.isMesh && node.material) {
      node.material.metalness = 0.3;
      node.material.roughness = 0.4;
      node.material.envMapIntensity = 1.5;
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });

  // Center the model
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());

  // Move model so its center is at the origin for predictable rotations
  if (isFinite(center.x) && isFinite(center.y) && isFinite(center.z)) {
    model.position.sub(center);
  }

  // Add debug helpers after model is centered
  if (DEBUG_HELPERS) {
    const axesHelper = new THREE.AxesHelper(1.5);
    scene.add(axesHelper);

    const camHelper = new THREE.CameraHelper(camera);
    scene.add(camHelper);

    // Visualize the bounding box
    const boxHelper = new THREE.Box3Helper(box, 0x00ff88);
    scene.add(boxHelper);

    // Optional orbit controls if available
    if (THREE.OrbitControls && !controls) {
      controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.06;
    }
  }

  modelsGroup.add(model);

  // Frame camera to all current content
  frameCameraToObject(modelsGroup);

  playInitialAnimation();
  animate();
});

// Load a second model and place it next to the first
loader.load("./water.glb", function (gltf) {
  model2 = gltf.scene;

  // Material tweaks and shadows
  model2.traverse((node) => {
    if (node.isMesh && node.material) {
      node.material.metalness = 0.3;
      node.material.roughness = 0.4;
      node.material.envMapIntensity = 1.5;
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });

  // Center the model at origin then offset it on X
  const box2 = new THREE.Box3().setFromObject(model2);
  const center2 = box2.getCenter(new THREE.Vector3());
  const size2 = box2.getSize(new THREE.Vector3());
  if (isFinite(center2.x) && isFinite(center2.y) && isFinite(center2.z)) {
    model2.position.sub(center2);
  }
  // Offset to the right of the first model using its own size as spacing
  const spacing = Math.max(size2.x || 1, 1) * 1;
  model2.position.x = spacing;

  modelsGroup.add(model2);

  // Re-frame camera to include both models
  frameCameraToObject(modelsGroup);
});

// Helper: frame camera to fit an object/group into view
function frameCameraToObject(object3D) {
  const box = new THREE.Box3().setFromObject(object3D);
  if (!isFinite(box.min.x) || !isFinite(box.max.x)) return;

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  // Put group center at origin for consistent framing without moving world
  // Instead of translating the group, adjust camera to look at center
  const maxDim = Math.max(size.x || 0, size.y || 0, size.z || 0);
  const fitOffset = 1.5;
  const fov = camera.fov * (Math.PI / 180);
  const distance = maxDim > 0 ? ((maxDim / 2) / Math.tan(fov / 2) * fitOffset) : camera.position.z;

  camera.position.set(center.x, center.y, center.z + distance);
  camera.near = Math.max(distance / 100, 0.01);
  camera.far = distance * 100;
  camera.updateProjectionMatrix();
  camera.lookAt(center);

  if (typeof controls !== "undefined" && controls) {
    controls.target.copy(center);
    controls.update();
  }
}

// ====================== RESIZE HANDLER ======================
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// ====================== INITIAL ANIMATION ======================
function playInitialAnimation() {
  if (!model) return;

  // gsap.to(model.scale, { x: 1, y: 1, z: 1, duration: 1, ease: "power2.inOut" });
  gsap.to(scanContainer, { scale: 1, duration: 1, ease: "power2.inOut" });
}

// ====================== SCROLL TRIGGERS ======================
ScrollTrigger.create({
  trigger: "body",
  start: "top top",
  end: "top -10",
  onEnterBack: () => {
    if (!model) return;
    gsap.to(model.scale, { x: 1, y: 1, z: 1, duration: 1, ease: "power2.out" });
    isFloating = true;
    gsap.to(scanContainer, { scale: 1, duration: 1, ease: "power2.inOut" });
  },
});

ScrollTrigger.create({
  trigger: ".scanner",
  start: "top top",
  end: `${stickyHeight}px`,
  pin: true,
  onEnter: () => {
    if (!model) return;
    isFloating = false;
    model.position.y = 0;

    setTimeout(() => {
      scanSound.currentTime = 0;
      scanSound.play();
    }, 500);

    gsap.to(model.rotation, {
      y: model.rotation.y + Math.PI * 2,
      duration: 1,
      ease: "power2.inOut",
      onComplete: () => {
        gsap.to(model.scale, {
          x: 1,
          y: 1,
          z: 1,
          duration: 0.5,
          ease: "power2.in",
          onComplete: () => {
            gsap.to(scanContainer, { scale: 0, duration: 0.5, ease: "power2.in" });
          },
        });
      },
    });
  },
  onLeaveBack: () => {
    gsap.set(scanContainer, { scale: 0 });
    gsap.to(scanContainer, { scale: 1, duration: 1, ease: "power2.out" });
    if (!model) return;
    gsap.to(model.scale, { x: 1, y: 1, z: 1, duration: 1, ease: "power2.out" });
  },
});

// ====================== SCROLL LISTENER ======================
lenis.on("scroll", (e) => {
  currentScroll = e.scroll;
});

// ====================== ANIMATION LOOP ======================
function animate() {
  if (model || model2) {
    // Floating effect
    if (isFloating) {
      const floatOffset = Math.sin(Date.now() * 0.01 * floatSpeed) * floatAmplitude;
      const floatOffset2 = Math.sin(Date.now() * 0.01 * floatSpeed) * floatAmplitude;
      if (model) model.position.y = floatOffset;
      if (model2) model2.position.y = floatOffset2;
    }

    // Rotation based on scroll
    const scrollProgress = Math.min(currentScroll / scannerPosition, 1);
    if (scrollProgress < 1) {
      if (model) {
        model.rotation.x = scrollProgress * Math.PI * 2;
        model.rotation.y += 0.01 * rotationSpeed;
      }
      // if (model2) {
      //   model2.rotation.x = scrollProgress * Math.PI * 3;
      //   model2.rotation.y += 0.02 * rotationSpeed;
      // }
    }
  }
  if (controls) {
    controls.update();
  }
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

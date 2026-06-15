const CANVAS_SELECTOR = "[data-home-fluid]";

const VERTEX_SHADER = `
attribute vec2 aPosition;
varying vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const UPDATE_SHADER = `
precision mediump float;

uniform sampler2D uTexture;
uniform vec2 uTexel;
uniform vec2 uPointer;
uniform vec2 uVelocity;
uniform float uSplat;
uniform float uTime;
varying vec2 vUv;

float wave(vec2 point, float scale, float speed) {
  return sin(point.x * scale + uTime * speed) * cos(point.y * (scale * 0.82) - uTime * speed);
}

void main() {
  vec2 uv = vUv;
  vec2 centered = uv - 0.5;
  float curl = wave(uv, 9.0, 0.22) + wave(uv.yx, 13.0, -0.16);
  vec2 flow = vec2(curl * centered.y, -curl * centered.x) * 0.014;
  flow += vec2(sin((uv.y + uTime * 0.04) * 18.0), cos((uv.x - uTime * 0.05) * 16.0)) * 0.0018;

  vec2 pointerDelta = uv - uPointer;
  float pointerForce = exp(-dot(pointerDelta, pointerDelta) * 420.0) * uSplat;
  flow += normalize(uVelocity + 0.0001) * pointerForce * 0.022;

  vec4 color = texture2D(uTexture, uv - flow - uVelocity * pointerForce * 0.004);
  color.rgb *= 0.982;

  vec3 splatColor = 0.52 + 0.48 * cos(6.28318 * (vec3(0.58, 0.68, 0.78) + uTime * 0.035));
  splatColor *= vec3(0.35, 0.82, 1.0);
  color.rgb += splatColor * pointerForce * 0.68;

  vec2 idlePoint = vec2(0.5 + sin(uTime * 0.09) * 0.22, 0.52 + cos(uTime * 0.07) * 0.18);
  float idle = exp(-dot(uv - idlePoint, uv - idlePoint) * 34.0);
  color.rgb += vec3(0.012, 0.032, 0.045) * idle;

  gl_FragColor = vec4(color.rgb, 1.0);
}
`;

const RENDER_SHADER = `
precision mediump float;

uniform sampler2D uTexture;
uniform float uTime;
varying vec2 vUv;

void main() {
  vec2 uv = vUv;
  vec3 color = texture2D(uTexture, uv).rgb;
  color += vec3(0.012, 0.025, 0.035) * (0.5 + 0.5 * sin(uTime * 0.16 + uv.x * 7.0));
  color *= smoothstep(0.95, 0.2, distance(uv, vec2(0.5)));
  gl_FragColor = vec4(color, 1.0);
}
`;

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) || "Unable to compile shader");
  }

  return shader;
}

function createProgram(gl, fragmentSource) {
  const program = gl.createProgram();
  gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || "Unable to link shader program");
  }

  return program;
}

function createTarget(gl, width, height) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

  return { framebuffer, height, texture, width };
}

function initHomeFluid() {
  const canvas = document.querySelector(CANVAS_SELECTOR);
  if (!(canvas instanceof HTMLCanvasElement) || canvas.dataset.fluidReady === "true") return;

  canvas.dataset.fluidReady = "true";

  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    canvas.hidden = true;
    return;
  }

  const gl =
    canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
    }) ||
    canvas.getContext("experimental-webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
    });

  if (!gl) {
    canvas.hidden = true;
    return;
  }

  const host = canvas.closest(".home-fluid");
  const updateProgram = createProgram(gl, UPDATE_SHADER);
  const renderProgram = createProgram(gl, RENDER_SHADER);
  const buffer = gl.createBuffer();
  const pointer = {
    active: 0,
    x: 0.5,
    y: 0.5,
    vx: 0,
    vy: 0,
  };
  let targets = [];
  let sourceIndex = 0;
  let frame = 0;
  let width = 0;
  let height = 0;

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );

  const bindPosition = (program) => {
    const location = gl.getAttribLocation(program, "aPosition");
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
  };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const nextWidth = Math.max(2, Math.floor(rect.width * dpr * 0.58));
    const nextHeight = Math.max(2, Math.floor(rect.height * dpr * 0.58));

    canvas.width = Math.max(2, Math.floor(rect.width * dpr));
    canvas.height = Math.max(2, Math.floor(rect.height * dpr));

    if (nextWidth === width && nextHeight === height) return;

    targets.forEach((target) => {
      gl.deleteFramebuffer(target.framebuffer);
      gl.deleteTexture(target.texture);
    });

    width = nextWidth;
    height = nextHeight;
    targets = [createTarget(gl, width, height), createTarget(gl, width, height)];
    sourceIndex = 0;
  };

  const updatePointer = (event) => {
    const rect = canvas.getBoundingClientRect();
    const nextX = (event.clientX - rect.left) / rect.width;
    const nextY = 1 - (event.clientY - rect.top) / rect.height;

    pointer.vx = nextX - pointer.x;
    pointer.vy = nextY - pointer.y;
    pointer.x = Math.min(1, Math.max(0, nextX));
    pointer.y = Math.min(1, Math.max(0, nextY));
    pointer.active = 1;
  };

  const draw = (time) => {
    resize();

    const source = targets[sourceIndex];
    const destination = targets[1 - sourceIndex];
    const elapsed = time * 0.001;
    const idleX = 0.5 + Math.sin(elapsed * 0.31) * 0.22;
    const idleY = 0.52 + Math.cos(elapsed * 0.27) * 0.18;
    const splat = Math.max(pointer.active, frame < 72 ? 0.55 : 0.08);

    gl.useProgram(updateProgram);
    bindPosition(updateProgram);
    gl.viewport(0, 0, destination.width, destination.height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, destination.framebuffer);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, source.texture);
    gl.uniform1i(gl.getUniformLocation(updateProgram, "uTexture"), 0);
    gl.uniform2f(gl.getUniformLocation(updateProgram, "uTexel"), 1 / width, 1 / height);
    gl.uniform2f(
      gl.getUniformLocation(updateProgram, "uPointer"),
      pointer.active ? pointer.x : idleX,
      pointer.active ? pointer.y : idleY,
    );
    gl.uniform2f(
      gl.getUniformLocation(updateProgram, "uVelocity"),
      pointer.active ? pointer.vx : Math.cos(elapsed * 0.25) * 0.012,
      pointer.active ? pointer.vy : Math.sin(elapsed * 0.2) * 0.012,
    );
    gl.uniform1f(gl.getUniformLocation(updateProgram, "uSplat"), splat);
    gl.uniform1f(gl.getUniformLocation(updateProgram, "uTime"), elapsed);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    sourceIndex = 1 - sourceIndex;
    pointer.active *= 0.86;
    pointer.vx *= 0.82;
    pointer.vy *= 0.82;
    frame += 1;

    gl.useProgram(renderProgram);
    bindPosition(renderProgram);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, targets[sourceIndex].texture);
    gl.uniform1i(gl.getUniformLocation(renderProgram, "uTexture"), 0);
    gl.uniform1f(gl.getUniformLocation(renderProgram, "uTime"), elapsed);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    requestAnimationFrame(draw);
  };

  window.addEventListener("pointermove", updatePointer, { passive: true });
  window.addEventListener("resize", resize, { passive: true });
  host?.classList.add("is-webgl-ready");
  requestAnimationFrame(draw);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initHomeFluid, { once: true });
} else {
  initHomeFluid();
}

addEventListener("astro:page-load", initHomeFluid);

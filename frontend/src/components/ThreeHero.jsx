import { useEffect, useRef } from 'react';

// The MaintainIQ hero: a rotating cube with a REAL, scannable QR code printed
// on every face (it encodes this site's URL — judges can scan it right off the
// hero), pierced by a scanning laser plane. Mouse moves the camera in parallax.
// three + qrcode are imported dynamically so none of it lands in the main bundle.
export default function ThreeHero() {
  const mountRef = useRef(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    let disposed = false;
    let renderer;
    let frameId;
    let cleanupEvents;

    (async () => {
      const [THREE, QRCode] = await Promise.all([
        import('three'),
        import('qrcode'),
      ]);
      if (disposed || !mountRef.current) return;

      const mount = mountRef.current;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(42, mount.clientWidth / mount.clientHeight, 0.1, 100);
      camera.position.set(0, 0.4, 7);

      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      mount.appendChild(renderer.domElement);

      const TEAL = 0x2dd4bf;

      // ── Build the QR face texture: real QR + wordmark, drawn on a canvas ──
      const qrDataUrl = await QRCode.toDataURL(window.location.origin, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 420,
        color: { dark: '#0A141A', light: '#F2FBF8' },
      });

      const faceCanvas = document.createElement('canvas');
      faceCanvas.width = 512;
      faceCanvas.height = 512;
      const ctx = faceCanvas.getContext('2d');

      await new Promise((resolve) => {
        const qrImage = new Image();
        qrImage.onload = () => {
          // Ivory face with the QR centered + brand marks, like a printed asset label.
          ctx.fillStyle = '#F2FBF8';
          ctx.fillRect(0, 0, 512, 512);
          ctx.drawImage(qrImage, 46, 30, 420, 420);

          // Teal corner brackets (scan-frame motif)
          ctx.strokeStyle = '#0E9F88';
          ctx.lineWidth = 10;
          const corner = 46;
          const pad = 14;
          [[pad, pad, 1, 1], [512 - pad, pad, -1, 1], [pad, 512 - pad, 1, -1], [512 - pad, 512 - pad, -1, -1]].forEach(([x, y, dx, dy]) => {
            ctx.beginPath();
            ctx.moveTo(x, y + corner * dy);
            ctx.lineTo(x, y);
            ctx.lineTo(x + corner * dx, y);
            ctx.stroke();
          });

          // Wordmark strip at the bottom
          ctx.fillStyle = '#0A141A';
          ctx.font = '800 30px Outfit, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('M A I N T A I N I Q', 256, 492);
          resolve();
        };
        qrImage.src = qrDataUrl;
      });

      const faceTexture = new THREE.CanvasTexture(faceCanvas);
      faceTexture.anisotropy = 8;
      faceTexture.colorSpace = THREE.SRGBColorSpace;

      // ── The QR cube ──
      scene.add(new THREE.AmbientLight(0xffffff, 1.15));
      const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
      keyLight.position.set(4, 6, 5);
      scene.add(keyLight);
      const tealFill = new THREE.PointLight(TEAL, 30, 30);
      tealFill.position.set(-5, -2, 4);
      scene.add(tealFill);

      const cubeGroup = new THREE.Group();
      const cube = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 2.6, 2.6),
        new THREE.MeshStandardMaterial({ map: faceTexture, roughness: 0.35, metalness: 0.05 })
      );
      cubeGroup.add(cube);

      // Glowing teal edges make the cube pop against the dark backdrop.
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(cube.geometry),
        new THREE.LineBasicMaterial({ color: TEAL, transparent: true, opacity: 0.95 })
      );
      edges.scale.setScalar(1.002);
      cubeGroup.add(edges);

      scene.add(cubeGroup);

      // ── Scanning laser: a translucent teal plane sweeping through the cube ──
      const scanPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(4.4, 4.4),
        new THREE.MeshBasicMaterial({ color: TEAL, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })
      );
      scanPlane.rotation.x = Math.PI / 2;
      scene.add(scanPlane);

      const scanLine = new THREE.Mesh(
        new THREE.RingGeometry(2.05, 2.1, 4, 1),
        new THREE.MeshBasicMaterial({ color: TEAL, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })
      );
      scanLine.rotation.x = Math.PI / 2;
      scanLine.rotation.z = Math.PI / 4;
      scene.add(scanLine);

      // Tiny data-dots drifting upward around the cube (scan "particles").
      const dotGeometry = new THREE.BufferGeometry();
      const dotCount = 70;
      const positions = new Float32Array(dotCount * 3);
      for (let i = 0; i < dotCount; i += 1) {
        positions[i * 3] = (Math.random() - 0.5) * 7;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 6;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 4 - 1;
      }
      dotGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const dots = new THREE.Points(
        dotGeometry,
        new THREE.PointsMaterial({ color: TEAL, size: 0.035, transparent: true, opacity: 0.65 })
      );
      scene.add(dots);

      // ── Interaction ──
      const pointer = { x: 0, y: 0 };
      const handlePointer = (event) => {
        const rect = mount.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
        pointer.y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
      };
      window.addEventListener('pointermove', handlePointer);

      const handleResize = () => {
        if (!mount.clientWidth || !mount.clientHeight) return;
        camera.aspect = mount.clientWidth / mount.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(mount.clientWidth, mount.clientHeight);
      };
      window.addEventListener('resize', handleResize);

      cleanupEvents = () => {
        window.removeEventListener('pointermove', handlePointer);
        window.removeEventListener('resize', handleResize);
      };

      const clock = new THREE.Clock();
      const animate = () => {
        const elapsed = clock.getElapsedTime();

        // Slow tumble + gentle float, leaning toward the cursor.
        cubeGroup.rotation.y = elapsed * 0.45 + pointer.x * 0.35;
        cubeGroup.rotation.x = Math.sin(elapsed * 0.35) * 0.22 + pointer.y * 0.25;
        cubeGroup.position.y = Math.sin(elapsed * 0.8) * 0.18;

        // Laser sweep through the cube.
        const sweep = Math.sin(elapsed * 1.1) * 1.9;
        scanPlane.position.y = sweep + cubeGroup.position.y;
        scanLine.position.y = sweep + cubeGroup.position.y;
        scanLine.rotation.z = Math.PI / 4 + elapsed * 0.1;
        const nearCube = Math.max(0, 1 - Math.abs(sweep) / 1.5);
        scanPlane.material.opacity = 0.05 + nearCube * 0.16;
        scanLine.material.opacity = 0.25 + nearCube * 0.65;

        // Particles drift upward and wrap.
        const positionAttr = dots.geometry.attributes.position;
        for (let i = 0; i < dotCount; i += 1) {
          let y = positionAttr.getY(i) + 0.006;
          if (y > 3) y = -3;
          positionAttr.setY(i, y);
        }
        positionAttr.needsUpdate = true;

        camera.position.x += (pointer.x * 0.9 - camera.position.x) * 0.05;
        camera.position.y += (0.4 - pointer.y * 0.7 - camera.position.y) * 0.05;
        camera.lookAt(0, 0, 0);

        renderer.render(scene, camera);
        frameId = requestAnimationFrame(animate);
      };
      animate();
    })();

    return () => {
      disposed = true;
      if (frameId) cancelAnimationFrame(frameId);
      if (cleanupEvents) cleanupEvents();
      if (renderer) {
        renderer.dispose();
        renderer.domElement?.parentNode?.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} className="h-full w-full" aria-hidden="true" />;
}

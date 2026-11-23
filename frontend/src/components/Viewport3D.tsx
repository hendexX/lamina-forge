import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Grid, Lightformer, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import {
  Box,
  Grid3X3,
  Layers,
  RotateCcw,
  RotateCw,
  Ruler,
  Triangle,
  CircleDot,
} from 'lucide-react';
import { useStudioStore } from '../store/useStudioStore';
import { PbrChannel, PRESET_CONFIG, PresetType } from '../types/studio';

const CHANNEL_OPTIONS: { id: PbrChannel; label: string }[] = [
  { id: 'full_pbr', label: 'Full PBR' },
  { id: 'albedo', label: 'Albedo' },
  { id: 'clay', label: 'Clay / Matcap' },
  { id: 'roughness_metallic', label: 'Rough / Metal' },
];

interface LoadedModelProps {
  url: string;
  pbrChannel: PbrChannel;
  wireframe: boolean;
  isDark: boolean;
}

const LoadedModel: React.FC<LoadedModelProps> = ({ url, pbrChannel, wireframe, isDark }) => {
  const setLiveMeshStats = useStudioStore((s) => s.setLiveMeshStats);
  const setActiveSceneObject = useStudioStore((s) => s.setActiveSceneObject);
  const [sceneGroup, setSceneGroup] = useState<THREE.Group | null>(null);

  const clayMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#d8dee9',
        roughness: 0.78,
        metalness: 0.04,
      }),
    [],
  );

  const wireMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: isDark ? '#38bdf8' : '#0284c7',
        wireframe: true,
        transparent: true,
        opacity: 0.34,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    [isDark],
  );

  useEffect(() => {
    let cancelled = false;
    const loader = new GLTFLoader();

    loader.load(
      url,
      (gltf) => {
        if (cancelled) return;
        const root = gltf.scene;

        let triangles = 0;
        let vertices = 0;

        root.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.userData.__origMaterial = mesh.material;

            const geom = mesh.geometry;
            if (geom) {
              const posAttr = geom.getAttribute('position');
              if (posAttr) vertices += posAttr.count;
              if (geom.index) {
                triangles += Math.floor(geom.index.count / 3);
              } else if (posAttr) {
                triangles += Math.floor(posAttr.count / 3);
              }
            }
          }
        });

        const box = new THREE.Box3().setFromObject(root);
        const size = new THREE.Vector3();
        box.getSize(size);

        setSceneGroup(root);
        setActiveSceneObject(root);
        setLiveMeshStats({
          triangles,
          vertices,
          width_m: Number(size.x.toFixed(3)),
          height_m: Number(size.y.toFixed(3)),
          depth_m: Number(size.z.toFixed(3)),
        });
      },
      undefined,
      (err) => {
        console.error('Failed to load GLB into viewport:', err);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [url, setLiveMeshStats, setActiveSceneObject]);

  // Apply PBR Channel Inspector & Wireframe Overlay
  useEffect(() => {
    if (!sceneGroup) return;

    const createdMaterials: THREE.Material[] = [];
    const createdWireMeshes: THREE.Mesh[] = [];

    sceneGroup.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh && !obj.userData.__isWireOverlay) {
        const mesh = obj as THREE.Mesh;
        const origMat = mesh.userData.__origMaterial as THREE.Material | THREE.Material[] | undefined;

        // Remove any previous wireframe overlay child
        const existingWire = mesh.children.find((c) => c.userData.__isWireOverlay);
        if (existingWire) {
          mesh.remove(existingWire);
        }

        if (origMat && !Array.isArray(origMat)) {
          const std = origMat as THREE.MeshStandardMaterial;
          if (pbrChannel === 'full_pbr') {
            mesh.material = origMat;
          } else if (pbrChannel === 'clay') {
            mesh.material = clayMaterial;
          } else if (pbrChannel === 'albedo') {
            const hasVertColors = Boolean(mesh.geometry.getAttribute('color'));
            const albedoMat = new THREE.MeshBasicMaterial({
              color: std.color ? std.color.clone() : new THREE.Color('#ffffff'),
              map: std.map ?? null,
              vertexColors: hasVertColors,
            });
            createdMaterials.push(albedoMat);
            mesh.material = albedoMat;
          } else if (pbrChannel === 'roughness_metallic') {
            const roughVal = typeof std.roughness === 'number' ? std.roughness : 0.5;
            const metalVal = typeof std.metalness === 'number' ? std.metalness : 0.1;
            const rmMat = new THREE.MeshStandardMaterial({
              color: new THREE.Color(metalVal * 0.9 + 0.1, roughVal * 0.9 + 0.1, 0.55),
              roughness: roughVal,
              metalness: metalVal,
              roughnessMap: std.roughnessMap ?? null,
              metalnessMap: std.metalnessMap ?? null,
            });
            createdMaterials.push(rmMat);
            mesh.material = rmMat;
          }
        }

        if (wireframe) {
          const wireOverlay = new THREE.Mesh(mesh.geometry, wireMaterial);
          wireOverlay.userData.__isWireOverlay = true;
          wireOverlay.renderOrder = 2;
          mesh.add(wireOverlay);
          createdWireMeshes.push(wireOverlay);
        }
      }
    });

    return () => {
      createdWireMeshes.forEach((w) => w.parent?.remove(w));
      createdMaterials.forEach((m) => m.dispose());
    };
  }, [sceneGroup, pbrChannel, wireframe, clayMaterial, wireMaterial]);

  if (!sceneGroup) return null;
  return <primitive object={sceneGroup} />;
};

const CameraRig: React.FC<{ autoRotate: boolean; resetCounter: number }> = ({
  autoRotate,
  resetCounter,
}) => {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();

  useEffect(() => {
    if (resetCounter === 0) return;
    camera.position.set(2.4, 1.8, 2.8);
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0.85, 0);
      controlsRef.current.update();
    }
  }, [resetCounter, camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.07}
      autoRotate={autoRotate}
      autoRotateSpeed={1.8}
      target={[0, 0.85, 0]}
      minDistance={0.7}
      maxDistance={12}
      maxPolarAngle={Math.PI * 0.495}
    />
  );
};

export const Viewport3D: React.FC = () => {
  const {
    theme,
    autoRotate,
    setAutoRotate,
    wireframe,
    setWireframe,
    pbrChannel,
    setPbrChannel,
    cameraResetCounter,
    triggerCameraReset,
    activeGlbUrl,
    liveMeshStats,
    assets,
    activeAssetId,
  } = useStudioStore();

  const isDark = theme === 'dark';
  const bgHex = isDark ? '#0F172A' : '#F6F7F9';
  const activeAsset = assets.find((a) => a.id === activeAssetId);
  const activePresetLabel = activeAsset
    ? PRESET_CONFIG[activeAsset.preset as PresetType]?.shortLabel
    : null;

  return (
    <main
      className="relative flex-1 h-full overflow-hidden select-none"
      style={{ backgroundColor: bgHex }}
    >
      {/* Interactive Three.js Canvas */}
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [2.4, 1.8, 2.8], fov: 40, near: 0.05, far: 100 }}
        gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: THREE.ACESFilmicToneMapping }}
      >
        <color attach="background" args={[bgHex]} />
        <fog attach="fog" args={[bgHex, 10, 26]} />

        {/* Procedural Studio HDRI Lighting (offline-safe Lightformers) */}
        <Environment resolution={256}>
          <Lightformer
            form="rect"
            intensity={2.4}
            color="#ffffff"
            scale={[6, 6, 1]}
            position={[0, 6, 2]}
            rotation={[Math.PI / 2, 0, 0]}
          />
          <Lightformer
            form="rect"
            intensity={1.6}
            color="#e0f2fe"
            scale={[4, 4, 1]}
            position={[5, 2.5, 4]}
            target={[0, 1, 0]}
          />
          <Lightformer
            form="rect"
            intensity={1.2}
            color="#fef3c7"
            scale={[4, 3, 1]}
            position={[-5, 2, -3]}
            target={[0, 1, 0]}
          />
        </Environment>

        <ambientLight intensity={isDark ? 0.35 : 0.55} />
        <directionalLight
          position={[4, 6, 4]}
          intensity={isDark ? 1.4 : 1.7}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <directionalLight position={[-4, 3, -3]} intensity={0.6} color="#bae6fd" />

        {/* Studio Cyclorama Grid & Contact Shadows */}
        <Grid
          position={[0, 0, 0]}
          args={[16, 16]}
          cellSize={0.5}
          cellThickness={0.5}
          cellColor={isDark ? '#1e293b' : '#cbd5e1'}
          sectionSize={2}
          sectionThickness={1}
          sectionColor={isDark ? '#334155' : '#94a3b8'}
          fadeDistance={14}
          fadeStrength={1.2}
          infiniteGrid
        />
        <ContactShadows
          position={[0, 0.002, 0]}
          opacity={isDark ? 0.55 : 0.35}
          scale={8}
          blur={2.2}
          far={4}
        />

        {activeGlbUrl && (
          <LoadedModel
            url={activeGlbUrl}
            pbrChannel={pbrChannel}
            wireframe={wireframe}
            isDark={isDark}
          />
        )}

        <CameraRig autoRotate={autoRotate} resetCounter={cameraResetCounter} />
      </Canvas>

      {/* Empty Viewport Overlay */}
      {!activeGlbUrl && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className={`px-6 py-5 rounded-2xl border backdrop-blur-md text-center max-w-sm ${
              isDark
                ? 'bg-slate-900/75 border-slate-700/70 text-slate-200'
                : 'bg-white/80 border-slate-200 text-slate-800'
            }`}
          >
            <Box className="w-8 h-8 mx-auto mb-2.5 text-sky-400 opacity-90" strokeWidth={1.6} />
            <h3 className="text-sm font-semibold">Studio Viewport Ready</h3>
            <p className={`text-xs mt-1 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Drop a reference image or enter a prompt on the left dock to forge a PBR 3D asset with
              TRELLIS.2-4B.
            </p>
          </div>
        </div>
      )}

      {/* Top-Right Live Mesh Stats HUD */}
      {liveMeshStats && (
        <div
          className={`absolute top-4 right-4 rounded-xl border backdrop-blur-md px-3.5 py-2.5 text-[11px] font-mono space-y-1.5 shadow-lg ${
            isDark
              ? 'bg-slate-900/80 border-slate-700/70 text-slate-200'
              : 'bg-white/85 border-slate-200 text-slate-800'
          }`}
        >
          <div className="flex items-center justify-between gap-4 pb-1 border-b border-current/10">
            <span className="font-sans font-semibold text-[11px] tracking-wide uppercase opacity-75">
              Mesh Stats
            </span>
            {activePresetLabel && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400 font-sans font-medium">
                {activePresetLabel}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-5">
            <span className="flex items-center gap-1.5 opacity-70">
              <Triangle className="w-3 h-3 text-sky-400" /> Triangles
            </span>
            <span className="font-semibold">{liveMeshStats.triangles.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between gap-5">
            <span className="flex items-center gap-1.5 opacity-70">
              <CircleDot className="w-3 h-3 text-sky-400" /> Vertices
            </span>
            <span className="font-semibold">{liveMeshStats.vertices.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between gap-5">
            <span className="flex items-center gap-1.5 opacity-70">
              <Ruler className="w-3 h-3 text-sky-400" /> Bounds (m)
            </span>
            <span className="font-semibold">
              {liveMeshStats.width_m.toFixed(2)} × {liveMeshStats.height_m.toFixed(2)} ×{' '}
              {liveMeshStats.depth_m.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Floating Bottom Viewport Toolbar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-wrap items-center justify-center gap-2 px-3">
        {/* PBR Channel Inspector */}
        <div
          className={`flex items-center gap-1 p-1 rounded-xl border backdrop-blur-md shadow-lg ${
            isDark
              ? 'bg-slate-900/85 border-slate-700/80 text-slate-300'
              : 'bg-white/90 border-slate-200 text-slate-700'
          }`}
        >
          <Layers className="w-3.5 h-3.5 mx-1.5 opacity-60 hidden sm:block" />
          {CHANNEL_OPTIONS.map((ch) => {
            const active = pbrChannel === ch.id;
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => setPbrChannel(ch.id)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                  active
                    ? 'bg-sky-500 text-slate-950 font-semibold shadow-sm'
                    : isDark
                      ? 'hover:bg-slate-800 text-slate-300'
                      : 'hover:bg-slate-100 text-slate-700'
                }`}
              >
                {ch.label}
              </button>
            );
          })}
        </div>

        {/* Viewport Toggles (Wireframe, Turntable, Reset Camera) */}
        <div
          className={`flex items-center gap-1 p-1 rounded-xl border backdrop-blur-md shadow-lg ${
            isDark
              ? 'bg-slate-900/85 border-slate-700/80 text-slate-300'
              : 'bg-white/90 border-slate-200 text-slate-700'
          }`}
        >
          <button
            type="button"
            onClick={() => setWireframe(!wireframe)}
            title="Toggle Wireframe Overlay"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
              wireframe
                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                : isDark
                  ? 'hover:bg-slate-800'
                  : 'hover:bg-slate-100'
            }`}
          >
            <Grid3X3 className="w-3.5 h-3.5" />
            Wireframe
          </button>

          <button
            type="button"
            onClick={() => setAutoRotate(!autoRotate)}
            title="Toggle Turntable Auto-Rotate"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
              autoRotate
                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                : isDark
                  ? 'hover:bg-slate-800'
                  : 'hover:bg-slate-100'
            }`}
          >
            <RotateCw className="w-3.5 h-3.5" />
            Turntable
          </button>

          <button
            type="button"
            onClick={triggerCameraReset}
            title="Reset Camera View"
            className={`p-1.5 rounded-lg transition-colors ${
              isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </main>
  );
};

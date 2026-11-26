import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Grid, Lightformer, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import {
  Box,
  CircleDot,
  Grid3X3,
  Layers,
  RotateCcw,
  RotateCw,
  Ruler,
  Sparkles,
  Triangle,
} from 'lucide-react';
import { useStudioStore } from '../store/useStudioStore';
import { getStyleShortLabel, PbrChannel } from '../types/studio';

type SurfaceFinish = 'matte' | 'natural' | 'glossy';

const CHANNEL_OPTIONS: { id: PbrChannel; label: string }[] = [
  { id: 'full_pbr', label: 'Full PBR' },
  { id: 'albedo', label: 'Albedo' },
  { id: 'clay', label: 'Clay' },
  { id: 'roughness_metallic', label: 'Rough / Metal' },
];

const FINISH_OPTIONS: { id: SurfaceFinish; label: string }[] = [
  { id: 'matte', label: 'Matte' },
  { id: 'natural', label: 'Natural' },
  { id: 'glossy', label: 'Glossy' },
];

interface LoadedModelProps {
  url: string;
  pbrChannel: PbrChannel;
  surfaceFinish: SurfaceFinish;
  wireframe: boolean;
  isDark: boolean;
}

const LoadedModel: React.FC<LoadedModelProps> = ({
  url,
  pbrChannel,
  surfaceFinish,
  wireframe,
  isDark,
}) => {
  const setLiveMeshStats = useStudioStore((s) => s.setLiveMeshStats);
  const setActiveSceneObject = useStudioStore((s) => s.setActiveSceneObject);
  const [sceneGroup, setSceneGroup] = useState<THREE.Group | null>(null);

  const clayMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#e5e5ea',
        roughness: 0.78,
        metalness: 0.04,
      }),
    [],
  );

  const wireMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: isDark ? '#0A84FF' : '#0071E3',
        wireframe: true,
        transparent: true,
        opacity: 0.32,
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
            const stdMat = mesh.material as THREE.MeshStandardMaterial;
            mesh.userData.__origRoughness =
              !Array.isArray(mesh.material) && typeof stdMat.roughness === 'number'
                ? stdMat.roughness
                : 1.0;

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

        // Center horizontally and rest lowest point flush on Y=0 grid
        const alignBox = new THREE.Box3().setFromObject(root);
        if (!alignBox.isEmpty()) {
          const alignCenter = alignBox.getCenter(new THREE.Vector3());
          root.position.x -= alignCenter.x;
          root.position.z -= alignCenter.z;
          root.position.y -= alignBox.min.y;
        }
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

  useEffect(() => {
    if (!sceneGroup) return;

    const createdMaterials: THREE.Material[] = [];
    const createdWireMeshes: THREE.Mesh[] = [];

    sceneGroup.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh && !obj.userData.__isWireOverlay) {
        const mesh = obj as THREE.Mesh;
        const origMat = mesh.userData.__origMaterial as THREE.Material | THREE.Material[] | undefined;

        const existingWire = mesh.children.find((c) => c.userData.__isWireOverlay);
        if (existingWire) {
          mesh.remove(existingWire);
        }

        if (origMat && !Array.isArray(origMat)) {
          const std = origMat as THREE.MeshStandardMaterial;
          if (pbrChannel === 'full_pbr') {
            const origRoughness =
              typeof mesh.userData.__origRoughness === 'number'
                ? (mesh.userData.__origRoughness as number)
                : 1.0;
            if (surfaceFinish === 'natural') {
              std.roughness = origRoughness;
              std.envMapIntensity = 1.1;
            } else if (surfaceFinish === 'glossy') {
              std.roughness = Math.min(origRoughness, 0.55);
              std.envMapIntensity = 2.2;
            } else if (surfaceFinish === 'matte') {
              std.roughness = Math.max(origRoughness, 0.85);
              std.envMapIntensity = 0.6;
            }
            std.needsUpdate = true;
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
  }, [sceneGroup, pbrChannel, surfaceFinish, wireframe, clayMaterial, wireMaterial]);

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

  const [surfaceFinish, setSurfaceFinish] = useState<SurfaceFinish>('natural');
  const isDark = theme === 'dark';
  const fogHex = isDark ? '#161618' : '#EFEFF4';
  const activeAsset = assets.find((a) => a.id === activeAssetId);
  const activeStyleLabel = activeAsset ? getStyleShortLabel(activeAsset.preset) : null;

  return (
    <main
      className={`relative flex-1 h-full rounded-3xl border overflow-hidden select-none transition-all duration-200 shadow-[0_20px_50px_rgba(0,0,0,0.10)] ${
        isDark
          ? 'bg-gradient-to-b from-[#111113] to-[#1C1C1E] border-white/10'
          : 'bg-gradient-to-b from-[#F5F5F7] to-[#E8E8ED] border-white/60'
      }`}
    >
      {/* Interactive Three.js Canvas */}
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [2.4, 1.8, 2.8], fov: 40, near: 0.05, far: 100 }}
        gl={{
          antialias: true,
          alpha: true,
          preserveDrawingBuffer: true,
          toneMapping: THREE.ACESFilmicToneMapping,
        }}
      >
        <fog attach="fog" args={[fogHex, 11, 26]} />

        {/* Procedural Studio HDRI Lighting */}
        <Environment resolution={256}>
          <Lightformer
            form="rect"
            intensity={4.5}
            color="#ffffff"
            scale={[6, 6, 1]}
            position={[0, 6, 2]}
            rotation={[Math.PI / 2, 0, 0]}
          />
          <Lightformer
            form="rect"
            intensity={3.0}
            color="#eef6ff"
            scale={[4, 4, 1]}
            position={[5, 2.5, 4]}
            target={[0, 1, 0]}
          />
          <Lightformer
            form="rect"
            intensity={2.2}
            color="#fff7ed"
            scale={[4, 3, 1]}
            position={[-5, 2, -3]}
            target={[0, 1, 0]}
          />
        </Environment>

        <ambientLight intensity={isDark ? 0.4 : 0.6} />
        <directionalLight
          position={[4, 6, 4]}
          intensity={isDark ? 1.4 : 1.6}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <directionalLight position={[-4, 3, -3]} intensity={0.55} color="#dbeafe" />

        {/* Subtle Studio Grid & Contact Shadows */}
        <Grid
          position={[0, 0, 0]}
          args={[16, 16]}
          cellSize={0.5}
          cellThickness={0.45}
          cellColor={isDark ? '#2c2c2e' : '#d1d1d6'}
          sectionSize={2}
          sectionThickness={0.9}
          sectionColor={isDark ? '#3a3a3c' : '#aeaeb2'}
          fadeDistance={14}
          fadeStrength={1.3}
          infiniteGrid
        />
        <ContactShadows
          position={[0, 0.002, 0]}
          opacity={isDark ? 0.5 : 0.28}
          scale={8}
          blur={2.4}
          far={4}
        />

        {activeGlbUrl && (
          <LoadedModel
            url={activeGlbUrl}
            pbrChannel={pbrChannel}
            surfaceFinish={surfaceFinish}
            wireframe={wireframe}
            isDark={isDark}
          />
        )}

        <CameraRig autoRotate={autoRotate} resetCounter={cameraResetCounter} />
      </Canvas>

      {/* Empty Viewport Overlay */}
      {!activeGlbUrl && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
          <div
            className={`px-7 py-6 rounded-3xl border backdrop-blur-2xl text-center max-w-sm shadow-[0_20px_50px_rgba(0,0,0,0.12)] ${
              isDark
                ? 'bg-neutral-900/65 border-white/10 text-neutral-100'
                : 'bg-white/75 border-white/60 text-neutral-900'
            }`}
          >
            <Box
              className={`w-8 h-8 mx-auto mb-3 ${isDark ? 'text-[#0A84FF]' : 'text-[#0071E3]'}`}
              strokeWidth={1.6}
            />
            <h3 className="text-sm font-semibold tracking-[-0.01em]">Studio Viewport Ready</h3>
            <p className={`text-xs mt-1.5 leading-relaxed ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
              Drop a reference image or describe an object on the left dock to generate a clean
              watertight 3D mesh.
            </p>
          </div>
        </div>
      )}

      {/* Top-Right Frosted Mesh Stats HUD */}
      {liveMeshStats && (
        <div
          className={`absolute top-4 right-4 rounded-2xl border backdrop-blur-2xl px-4 py-3 text-[11px] tabular-nums space-y-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.12)] ${
            isDark
              ? 'bg-neutral-900/65 border-white/10 text-neutral-100'
              : 'bg-white/75 border-white/60 text-neutral-900'
          }`}
        >
          <div
            className={`flex items-center justify-between gap-4 pb-1.5 border-b ${
              isDark ? 'border-white/10' : 'border-black/[0.06]'
            }`}
          >
            <span className="font-semibold text-[10px] tracking-[0.06em] uppercase opacity-60">
              Mesh Stats
            </span>
            {activeStyleLabel && (
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  isDark
                    ? 'bg-[#0A84FF]/20 text-[#0A84FF]'
                    : 'bg-[#0071E3]/10 text-[#0071E3]'
                }`}
              >
                {activeStyleLabel}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-5">
            <span className="flex items-center gap-1.5 opacity-65">
              <Triangle className={`w-3 h-3 ${isDark ? 'text-[#0A84FF]' : 'text-[#0071E3]'}`} />
              Triangles
            </span>
            <span className="font-semibold">{liveMeshStats.triangles.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between gap-5">
            <span className="flex items-center gap-1.5 opacity-65">
              <CircleDot className={`w-3 h-3 ${isDark ? 'text-[#0A84FF]' : 'text-[#0071E3]'}`} />
              Vertices
            </span>
            <span className="font-semibold">{liveMeshStats.vertices.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between gap-5">
            <span className="flex items-center gap-1.5 opacity-65">
              <Ruler className={`w-3 h-3 ${isDark ? 'text-[#0A84FF]' : 'text-[#0071E3]'}`} />
              Bounds (m)
            </span>
            <span className="font-semibold">
              {liveMeshStats.width_m.toFixed(2)} × {liveMeshStats.height_m.toFixed(2)} ×{' '}
              {liveMeshStats.depth_m.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Floating Bottom Frosted Pill Toolbar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-wrap items-center justify-center gap-2 px-3">
        {/* PBR Channel Inspector */}
        <div
          className={`flex items-center gap-1 p-1 rounded-full border backdrop-blur-2xl shadow-[0_16px_40px_rgba(0,0,0,0.14)] ${
            isDark
              ? 'bg-neutral-900/75 border-white/12 text-neutral-300'
              : 'bg-white/80 border-white/60 text-neutral-700'
          }`}
        >
          <Layers className="w-3.5 h-3.5 mx-2 opacity-55 hidden sm:block" />
          {CHANNEL_OPTIONS.map((ch) => {
            const active = pbrChannel === ch.id;
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => setPbrChannel(ch.id)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-200 ${
                  active
                    ? isDark
                      ? 'bg-[#0A84FF] text-white shadow-sm'
                      : 'bg-[#0071E3] text-white shadow-sm'
                    : isDark
                      ? 'hover:bg-white/10 text-neutral-300'
                      : 'hover:bg-black/[0.06] text-neutral-700'
                }`}
              >
                {ch.label}
              </button>
            );
          })}
        </div>

        {/* Surface Finish Segmented Control */}
        {pbrChannel === 'full_pbr' && (
          <div
            title="Surface Finish"
            className={`flex items-center gap-1 p-1 rounded-full border backdrop-blur-2xl shadow-[0_16px_40px_rgba(0,0,0,0.14)] ${
              isDark
                ? 'bg-neutral-900/75 border-white/12 text-neutral-300'
                : 'bg-white/80 border-white/60 text-neutral-700'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 mx-2 opacity-55 hidden sm:block" />
            {FINISH_OPTIONS.map((opt) => {
              const active = surfaceFinish === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSurfaceFinish(opt.id)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-200 ${
                    active
                      ? isDark
                        ? 'bg-[#0A84FF] text-white shadow-sm'
                        : 'bg-[#0071E3] text-white shadow-sm'
                      : isDark
                        ? 'hover:bg-white/10 text-neutral-300'
                        : 'hover:bg-black/[0.06] text-neutral-700'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Viewport Toggles */}
        <div
          className={`flex items-center gap-1 p-1 rounded-full border backdrop-blur-2xl shadow-[0_16px_40px_rgba(0,0,0,0.14)] ${
            isDark
              ? 'bg-neutral-900/75 border-white/12 text-neutral-300'
              : 'bg-white/80 border-white/60 text-neutral-700'
          }`}
        >
          <button
            type="button"
            onClick={() => setWireframe(!wireframe)}
            title="Toggle Wireframe Overlay"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-200 ${
              wireframe
                ? isDark
                  ? 'bg-[#0A84FF]/20 text-[#0A84FF]'
                  : 'bg-[#0071E3]/12 text-[#0071E3]'
                : isDark
                  ? 'hover:bg-white/10'
                  : 'hover:bg-black/[0.06]'
            }`}
          >
            <Grid3X3 className="w-3.5 h-3.5" />
            Wireframe
          </button>

          <button
            type="button"
            onClick={() => setAutoRotate(!autoRotate)}
            title="Toggle Turntable Auto-Rotate"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-200 ${
              autoRotate
                ? isDark
                  ? 'bg-[#0A84FF]/20 text-[#0A84FF]'
                  : 'bg-[#0071E3]/12 text-[#0071E3]'
                : isDark
                  ? 'hover:bg-white/10'
                  : 'hover:bg-black/[0.06]'
            }`}
          >
            <RotateCw className="w-3.5 h-3.5" />
            Turntable
          </button>

          <button
            type="button"
            onClick={triggerCameraReset}
            title="Reset Camera View"
            className={`p-1.5 rounded-full transition-colors duration-200 ${
              isDark ? 'hover:bg-white/10' : 'hover:bg-black/[0.06]'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </main>
  );
};

import * as THREE from 'three';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { downloadJobFormatFromBackend } from './api';

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportGlbBuffer(buffer: ArrayBuffer, baseName: string): void {
  const blob = new Blob([buffer], { type: 'model/gltf-binary' });
  triggerBlobDownload(blob, `${baseName}.glb`);
}

export function exportObjectToObj(object: THREE.Object3D, baseName: string): void {
  const exporter = new OBJExporter();
  const objText = exporter.parse(object);
  const blob = new Blob([objText], { type: 'text/plain;charset=utf-8' });
  triggerBlobDownload(blob, `${baseName}.obj`);
}

export function exportObjectToStl(object: THREE.Object3D, baseName: string): void {
  const exporter = new STLExporter();
  const result = exporter.parse(object, { binary: true });
  let blob: Blob;
  if (result instanceof DataView) {
    const copy = new Uint8Array(result.byteLength);
    copy.set(new Uint8Array(result.buffer, result.byteOffset, result.byteLength));
    blob = new Blob([copy], { type: 'model/stl' });
  } else {
    blob = new Blob([result], { type: 'model/stl' });
  }
  triggerBlobDownload(blob, `${baseName}.stl`);
}

export async function exportFbxViaBackend(
  apiUrl: string,
  jobId: string | undefined,
  baseName: string,
): Promise<void> {
  if (!jobId) {
    throw new Error('FBX export requires an active backend job with headless Blender installed.');
  }
  const blob = await downloadJobFormatFromBackend(apiUrl, jobId, 'fbx');
  triggerBlobDownload(blob, `${baseName}.fbx`);
}

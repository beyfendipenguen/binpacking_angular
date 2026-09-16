
import { Base } from "@app/core/interfaces/base.interface";
import { Company } from "./company.interface";
import { Order } from "./order.interface";
import * as THREE from 'three';

export interface OrderResult extends Base {
  order: Order;
  company: Company;
  result: PackagePosition[];
  success: boolean;
  progress: number; // 0-100 arası
}

export interface PackageData {
  id: number;
  x: number;
  y: number;
  z: number;
  length: number;
  width: number;
  height: number;
  weight: number;
  color?: string;
  originalColor?: string;
  dimensions?: string;
  mesh?: THREE.Mesh;
  isBeingDragged?: boolean;
  rotation?: number;
  originalLength?: number;
  originalWidth?: number;
  pkgId: string;
  isForcePlaced?: boolean;
  forcePlaceBorder?: THREE.LineSegments;
  // Paketin üst + 4 yan yüzeyine (dik/çapraz/yatay — hangisi sığıyorsa)
  // çizilen ürün adı + adet etiketleri. Üst üste dizilen paketlerde üst
  // yüzey görünmeyebileceği için yanlara da eklenir. Sadece mouse üzerine
  // gelince görünür olur (bkz. ThreeJSTruckVisualizationComponent.
  // updateHoverEffects()).
  detailLabelMeshes?: THREE.Mesh[];
}

export interface PackageSnapshot {
  pkgId: string;
  id: any;
  x: number;
  y: number;
  z: number;
  length: number;
  width: number;
  height: number;
  weight: number;
  color: string | undefined;
  originalColor: string | undefined;
  rotation: number;
  originalLength: number;
  originalWidth: number;
  dimensions: string | undefined;
  isForcePlaced: boolean;
  isDeleted: boolean;
}

// NOT: aşağıdaki yorumlar önceden index4/5'i (height/depth) YANLIŞ
// sırayla belgeliyordu. Gerçek konvansiyon — hem backend'in ürettiği
// JSON'da (calculate_bin_packing_service_v3.py sonucu) hem de bu tuple'ı
// elle kuran her yerde (bkz. threejs-truck-visualization.component.ts
// addDeletedPackage çağrısı) TUTARLI şekilde — şu şekilde:
export type PackagePosition = [
  number,  // x
  number,  // y
  number,  // z
  number,  // width (x-ekseni boyu)
  number,  // depth (y-ekseni boyu)
  number,  // height
  number,  // name (paket sıra no)
  number,  // weight
  string   // pkgId
];

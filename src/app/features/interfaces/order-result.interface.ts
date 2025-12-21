
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
}

export type PackagePosition = [
  number,  // x
  number,  // y
  number,  // z
  number,  // width
  number,  // height
  number,  // depth
  string,  // id
  number,  // weight
  string   // pkgId
];

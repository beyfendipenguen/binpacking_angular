import { UiPallet } from '../stepper/components/ui-models/ui-pallet.model';
import { IUiPackage } from '../stepper/interfaces/ui-interfaces/ui-package.interface';
import { PackageReadDto, PackageWriteDto } from '../interfaces/package.interface';
import { PackageDetailWriteDto } from '../interfaces/package-detail.interface';


export function mapPackageReadDtoListToIUiPackageList(packages: PackageReadDto[]): IUiPackage[] {

  return packages.map(pkg => (
    {
      id: pkg.id,
      order_id: pkg.order_id,
      name: pkg.name,
      is_remaining: pkg.is_remaining,
      alignment: pkg.alignment,
      height: pkg.height,
      pallet: pkg.pallet ? new UiPallet({ ...pkg.pallet }) : null,
      package_details: pkg.package_details,
    } as IUiPackage
  ))
}

export function mapUiPackagesToPackageWriteDtoList(packages: IUiPackage[]): PackageWriteDto[] {
  return packages.map(mapUiPackageToPackageWriteDto)
}

export function mapUiPackageToPackageWriteDto(uiPkg: IUiPackage): PackageWriteDto {
  return {
    id: uiPkg.id,
    pallet_id: uiPkg.pallet?.id || '',
    alignment: uiPkg.alignment,
    height: uiPkg.height,
    is_remaining: uiPkg.is_remaining,
    name: uiPkg.name,
    order_id: uiPkg.order_id,
    package_details: uiPkg.package_details.map(detail => ({
      id: detail.id,
      product_id: detail.product.id,
      count: detail.count,
      priority: detail.priority,
      package_id: uiPkg.id,
    } as PackageDetailWriteDto))
  }
}

export function mapPackageReadDtoListToPackageWriteDtoList(packages: PackageReadDto[]): PackageWriteDto[] {
  return packages.map(mapPackageReadDtoToPackageWriteDto)
}

export function mapPackageReadDtoToPackageWriteDto(pkg: PackageReadDto): PackageWriteDto {
  return {
    id: pkg.id,
    alignment: pkg.alignment,
    pallet_id: pkg.pallet.id,
    height: pkg.height,
    name: pkg.name,
    is_remaining: pkg.is_remaining,
    order_id: pkg.order_id,
    package_details: pkg.package_details.map(pd => ({
      id: pd.id,
      count: pd.count,
      package_id: pd.package_id,
      priority: pd.priority,
      product_id: pd.product.id
    } as PackageDetailWriteDto))
  } as PackageWriteDto
}


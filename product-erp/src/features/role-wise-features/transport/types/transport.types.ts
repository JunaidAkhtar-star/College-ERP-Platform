export interface IBusRoute {
  _id: string;
  routeNo: string;
  routeName: string;
  stops: Array<{ stopName: string; stopTime: string; fareFromOrigin: number }>;
  occupiedCount: number;
  driverName: string;
  driverPhone: string;
  vehicleNo: string;
  vehicleType: string;
  capacity: number;
  isActive: boolean;
  createdAt: string;
  [key: string]: unknown;
}

export interface ICreateRouteDto {
  routeNo: string;
  routeName: string;
  stops: Array<{ stopName: string; stopTime: string; fareFromOrigin: number }>;
  driverName: string;
  driverPhone: string;
  vehicleNo: string;
  vehicleType: string;
  capacity: number;
  isActive: boolean;
}

declare module "paytmchecksum" {
  interface IPaytmChecksum {
    generateSignature(
      params: Record<string, string> | string,
      merchantKey: string,
    ): Promise<string>;
    verifySignature(
      params: Record<string, string> | string,
      merchantKey: string,
      checksum: string,
    ): boolean;
  }

  const PaytmChecksum: IPaytmChecksum;
  export default PaytmChecksum;
}

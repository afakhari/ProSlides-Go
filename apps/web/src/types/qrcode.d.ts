declare module "qrcode" {
  type QRCodeToDataURLOptions = {
    margin?: number;
    width?: number;
    errorCorrectionLevel?: "low" | "medium" | "quartile" | "high" | "L" | "M" | "Q" | "H";
  };

  type QRCodeModule = {
    toDataURL(
      text: string,
      options?: QRCodeToDataURLOptions,
    ): Promise<string>;
  };

  const QRCode: QRCodeModule;
  export default QRCode;
}

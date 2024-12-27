import { Component, ReactNode } from "react";
import JSZip from "jszip";

interface State {
  readonly uploadedFileName: string;
  readonly imageFiles: readonly ImageFile[];
  readonly shouldListFiles: boolean;
  readonly transparentPaddingInputValue: string;
  readonly croppedImageFiles: readonly ImageFile[];
}

interface ImageFile {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
  readonly url: string;
  readonly cropBounds: CropBounds;
}

interface CropBounds {
  readonly minVisiblePixelX: number;
  readonly maxVisiblePixelX: number;
  readonly minVisiblePixelY: number;
  readonly maxVisiblePixelY: number;
}

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".svg"];

export class App extends Component<{}, State> {
  constructor(props: {}) {
    super(props);

    this.state = {
      uploadedFileName: "",
      imageFiles: [],
      shouldListFiles: true,
      transparentPaddingInputValue: "0",
      croppedImageFiles: [],
    };

    this.bindMethods();
  }

  bindMethods(): void {
    this.onFileInputChange = this.onFileInputChange.bind(this);
    this.onShouldListFilesChange = this.onShouldListFilesChange.bind(this);
    this.onTransparentPaddingInputValueChange =
      this.onTransparentPaddingInputValueChange.bind(this);
    this.onCropButtonClick = this.onCropButtonClick.bind(this);
    this.onDownloadButtonClick = this.onDownloadButtonClick.bind(this);
  }

  render(): ReactNode {
    const {
      imageFiles,
      shouldListFiles,
      transparentPaddingInputValue,
      croppedImageFiles,
    } = this.state;

    return (
      <div>
        <h1>Autocropper</h1>

        <section>
          <h2>Step 1: Upload a file.</h2>

          {imageFiles.length === 0 ? (
            <>
              <p>Upload an image or zip file.</p>
              <p>Files with names that start with a "." will be ignored.</p>
              <input
                type="file"
                accept={[".zip"].concat(IMAGE_EXTENSIONS).join(",")}
                onChange={this.onFileInputChange}
              />
            </>
          ) : (
            <>
              <label>
                List files{" "}
                <input
                  type="checkbox"
                  checked={shouldListFiles}
                  onChange={this.onShouldListFilesChange}
                />
              </label>

              <p>
                Files ({imageFiles.length}){shouldListFiles ? ":" : ""}
              </p>

              {shouldListFiles && (
                <ol>
                  {imageFiles.map((file) => (
                    <li key={file.name}>
                      {file.name} ({file.width}x{file.height})
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
        </section>

        <section>
          <h2>Step 2: Select transparent padding.</h2>
          <input
            className={
              isValidNonNegativeInteger(transparentPaddingInputValue)
                ? ""
                : "InvalidInput"
            }
            type="text"
            value={transparentPaddingInputValue}
            onChange={this.onTransparentPaddingInputValueChange}
          />
        </section>

        <section>
          <h2>Step 3: Crop and review.</h2>

          {croppedImageFiles.length === 0 ? (
            <button
              disabled={
                !(
                  imageFiles.length > 0 &&
                  isValidNonNegativeInteger(transparentPaddingInputValue)
                )
              }
              onClick={this.onCropButtonClick}
            >
              Crop
            </button>
          ) : (
            <>
              <label>
                List files{" "}
                <input
                  type="checkbox"
                  checked={shouldListFiles}
                  onChange={this.onShouldListFilesChange}
                />
              </label>

              <p>
                Cropped files ({croppedImageFiles.length})
                {shouldListFiles ? ":" : ""}
              </p>

              {shouldListFiles && (
                <ol>
                  {croppedImageFiles.map((file, index) => (
                    <li className="PreviewContainer" key={file.name}>
                      <span className="PreviewName">
                        {index + 1}. {file.name} ({file.width}x{file.height})
                      </span>
                      <img
                        className="PreviewImage"
                        src={file.url}
                        alt={file.name}
                      />
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
        </section>

        <section>
          <h2>Step 4: Download the cropped images.</h2>
          <p>Click the button below to download the cropped images.</p>
          <button
            disabled={croppedImageFiles.length === 0}
            onClick={this.onDownloadButtonClick}
          >
            Download
          </button>
        </section>
      </div>
    );
  }

  onFileInputChange(event: React.ChangeEvent<HTMLInputElement>): void {
    const files = event.target.files;

    if (files === null || files.length === 0) {
      return;
    }

    const file = files[0];

    if (isZipFileName(file.name)) {
      this.onZipFileUpload(file);
      return;
    }

    if (isImageFileName(file.name)) {
      this.onImageFileUpload(file);
      return;
    }

    window.alert("Invalid file type.");
  }

  onZipFileUpload(file: File): void {
    JSZip.loadAsync(file)
      .then(getImageEntries)
      .then((imageEntries) => Promise.all(imageEntries.map(loadImageFile)))
      .then((imageFiles) => {
        this.setState({
          uploadedFileName: file.name,
          imageFiles,
          croppedImageFiles: [],
        });
      });
  }

  onImageFileUpload(file: File): void {
    // TODO
  }

  onShouldListFilesChange(event: React.ChangeEvent<HTMLInputElement>): void {
    this.setState({
      shouldListFiles: event.target.checked,
    });
  }

  onTransparentPaddingInputValueChange(
    event: React.ChangeEvent<HTMLInputElement>
  ): void {
    this.setState({
      transparentPaddingInputValue: event.target.value,
      croppedImageFiles: [],
    });
  }

  onCropButtonClick(): void {
    const { imageFiles, transparentPaddingInputValue } = this.state;

    if (
      !(
        imageFiles.length > 0 &&
        isValidNonNegativeInteger(transparentPaddingInputValue)
      )
    ) {
      return;
    }

    const transparentPadding = Number.parseInt(
      transparentPaddingInputValue,
      10
    );

    cropImagesAndAddPadding(imageFiles, transparentPadding).then(
      (croppedImageFiles) => {
        this.setState({
          croppedImageFiles,
        });
      }
    );
  }

  onDownloadButtonClick(): void {
    const { uploadedFileName, croppedImageFiles } = this.state;

    if (croppedImageFiles.length === 0) {
      return;
    }

    const zipped = zipImageFiles(croppedImageFiles);

    downloadZipFile(
      zipped,
      uploadedFileName.replace(/\.[zZ][iI][pP]$/, ".cropped.zip")
    );

    // TODO: Only download a single image file if there is only one image.
  }
}

function isZipFileName(name: string): boolean {
  const lowerCaseName = name.toLowerCase();

  if (
    lowerCaseName === "" ||
    lowerCaseName.split(/\/|\\/).slice(-1)[0].startsWith(".")
  ) {
    return false;
  }

  return lowerCaseName.endsWith(".zip");
}

function isImageFileName(name: string): boolean {
  const lowerCaseName = name.toLowerCase();

  if (
    lowerCaseName === "" ||
    lowerCaseName.split(/\/|\\/).slice(-1)[0].startsWith(".")
  ) {
    return false;
  }

  return IMAGE_EXTENSIONS.some((extension) =>
    lowerCaseName.endsWith(extension)
  );
}

function getImageEntries(zip: JSZip): readonly JSZip.JSZipObject[] {
  const out: JSZip.JSZipObject[] = [];

  zip.forEach((_, zipEntry) => {
    if (zipEntry.dir) {
      return;
    }

    if (!isImageFileName(zipEntry.name)) {
      return;
    }

    out.push(zipEntry);
  });

  return out.slice();
}

function loadImageFile(zipEntry: JSZip.JSZipObject): Promise<ImageFile> {
  const dotlessExtension = getDotlessExtension(zipEntry.name);
  if (!isImageFileName("test." + dotlessExtension)) {
    throw new Error("Invalid image file type. Name: " + zipEntry.name);
  }

  return zipEntry.async("arraybuffer").then((buffer) => {
    const blob = new Blob([buffer], {
      type: "image/" + dotlessExtension.toLowerCase(),
    });
    const url = URL.createObjectURL(blob);

    const image = new Image();

    const out = new Promise<ImageFile>((resolve, reject) => {
      image.addEventListener("load", () => {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;

        const context = canvas.getContext("2d")!;
        context.drawImage(image, 0, 0);
        const imageData = context.getImageData(
          0,
          0,
          canvas.width,
          canvas.height
        );

        const cropBounds = getCropBounds(imageData);

        canvas.toBlob((blob) => {
          if (blob === null) {
            const error = new Error(
              "Failed to create blob for " + zipEntry.name
            );
            reject(error);
            throw error;
          }

          const url = URL.createObjectURL(blob);

          resolve({
            name: zipEntry.name,
            width: canvas.width,
            height: canvas.height,
            data: imageData.data,
            url,
            cropBounds,
          });
        });
      });

      image.addEventListener("error", reject);
    });

    image.src = url;

    return out;
  });
}

function getDotlessExtension(name: string): string {
  return name.toLowerCase().split(".").pop() ?? "";
}

function getCropBounds({
  width,
  height,
  data,
}: {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}): CropBounds {
  let minVisiblePixelX = Infinity;
  let maxVisiblePixelX = -Infinity;
  let minVisiblePixelY = Infinity;
  let maxVisiblePixelY = -Infinity;

  for (let x = 0; x < width; ++x) {
    for (let y = 0; y < height; ++y) {
      const index = (y * width + x) * 4;

      if (data[index + 3] === 0) {
        continue;
      }

      minVisiblePixelX = Math.min(minVisiblePixelX, x);
      maxVisiblePixelX = Math.max(maxVisiblePixelX, x);
      minVisiblePixelY = Math.min(minVisiblePixelY, y);
      maxVisiblePixelY = Math.max(maxVisiblePixelY, y);
    }
  }

  return {
    minVisiblePixelX,
    maxVisiblePixelX,
    minVisiblePixelY,
    maxVisiblePixelY,
  };
}

function isValidNonNegativeInteger(s: string): boolean {
  return /^\d+$/.test(s);
}

function cropImagesAndAddPadding(
  imageFiles: readonly ImageFile[],
  transparentPadding: number
): Promise<readonly ImageFile[]> {
  return Promise.all(
    imageFiles.map((f) => cropImageAndAddPadding(f, transparentPadding))
  );
}

function cropImageAndAddPadding(
  imageFile: ImageFile,
  transparentPadding: number
): Promise<ImageFile> {
  const {
    minVisiblePixelX,
    maxVisiblePixelX,
    minVisiblePixelY,
    maxVisiblePixelY,
  } = imageFile.cropBounds;
  const unpaddedWidth = maxVisiblePixelX - minVisiblePixelX + 1;
  const unpaddedHeight = maxVisiblePixelY - minVisiblePixelY + 1;
  const unpaddedData = imageFile.data;

  const paddedWidth = unpaddedWidth + 2 * transparentPadding;
  const paddedHeight = unpaddedHeight + 2 * transparentPadding;
  const paddedData = new Uint8ClampedArray(paddedWidth * paddedHeight * 4);

  for (let cropRectX = 0; cropRectX < unpaddedWidth; ++cropRectX) {
    for (let cropRectY = 0; cropRectY < unpaddedHeight; ++cropRectY) {
      const sourceX = minVisiblePixelX + cropRectX;
      const sourceY = minVisiblePixelY + cropRectY;
      const sourceIndex = (sourceY * imageFile.width + sourceX) * 4;

      const destX = transparentPadding + cropRectX;
      const destY = transparentPadding + cropRectY;
      const destIndex = (destY * paddedWidth + destX) * 4;

      paddedData[destIndex] = unpaddedData[sourceIndex];
      paddedData[destIndex + 1] = unpaddedData[sourceIndex + 1];
      paddedData[destIndex + 2] = unpaddedData[sourceIndex + 2];
      paddedData[destIndex + 3] = unpaddedData[sourceIndex + 3];
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = paddedWidth;
  canvas.height = paddedHeight;
  const context = canvas.getContext("2d")!;
  const imageData = new ImageData(paddedData, paddedWidth, paddedHeight);
  context.putImageData(imageData, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob === null) {
        const error = new Error("Failed to create blob for " + imageFile.name);
        reject(error);
        throw error;
      }

      const url = URL.createObjectURL(blob);

      resolve({
        name: imageFile.name,
        width: paddedWidth,
        height: paddedHeight,
        data: paddedData,
        url,
        cropBounds: {
          minVisiblePixelX: transparentPadding,
          maxVisiblePixelX: transparentPadding + unpaddedWidth - 1,
          minVisiblePixelY: transparentPadding,
          maxVisiblePixelY: transparentPadding + unpaddedHeight - 1,
        },
      });
    });
  });
}

function zipImageFiles(imageFiles: readonly ImageFile[]): JSZip {
  const zip = new JSZip();

  for (const file of imageFiles) {
    const buffer = getImageFileBuffer(file);
    zip.file(file.name, buffer);
  }

  return zip;
}

function getImageFileBuffer(file: ImageFile): Promise<ArrayBuffer> {
  const canvas = document.createElement("canvas");
  canvas.width = file.width;
  canvas.height = file.height;
  const context = canvas.getContext("2d")!;
  const imageData = new ImageData(file.data, file.width, file.height);
  context.putImageData(imageData, 0, 0);

  const dotlessExtension = getDotlessExtension(file.name);
  const mimeType = "image/" + dotlessExtension.toLowerCase();
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob === null) {
        throw new Error("Failed to create blob for " + file.name);
      }

      resolve(blob.arrayBuffer());
    }, mimeType);
  });
}

function downloadZipFile(zip: JSZip, zipFileName: string): void {
  zip.generateAsync({ type: "blob" }).then((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = zipFileName;
    a.click();
  });
}

import { Component, ReactNode } from "react";
import JSZip from "jszip";

interface State {
  readonly isProcessingFile: boolean;
  readonly uploadedFileName: string;
  readonly originalImageFiles: readonly ImageFile[];
  readonly shouldHideOriginalPreviews: boolean;
  readonly transparentPaddingInputValue: string;
  readonly croppedImageFiles: readonly ImageFile[];
  readonly shouldHideCroppedPreviews: boolean;
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

const IMAGE_EXTENSIONS = [".png", ".svg"];

export class App extends Component<{}, State> {
  constructor(props: {}) {
    super(props);

    this.state = {
      isProcessingFile: false,
      uploadedFileName: "",
      originalImageFiles: [],
      shouldHideOriginalPreviews: false,
      transparentPaddingInputValue: "0",
      croppedImageFiles: [],
      shouldHideCroppedPreviews: false,
    };

    this.bindMethods();
  }

  bindMethods(): void {
    this.onFileInputChange = this.onFileInputChange.bind(this);
    this.onShouldHideOriginalPreviewsChange =
      this.onShouldHideOriginalPreviewsChange.bind(this);
    this.onShouldHideCroppedPreviewsChange =
      this.onShouldHideCroppedPreviewsChange.bind(this);
    this.onTransparentPaddingInputValueChange =
      this.onTransparentPaddingInputValueChange.bind(this);
    this.onCropButtonClick = this.onCropButtonClick.bind(this);
    this.onDownloadButtonClick = this.onDownloadButtonClick.bind(this);
    this.onDownloadCropMetadataButtonClick =
      this.onDownloadCropMetadataButtonClick.bind(this);
  }

  render(): ReactNode {
    const {
      isProcessingFile,
      uploadedFileName,
      shouldHideOriginalPreviews,
      originalImageFiles,
      transparentPaddingInputValue,
      croppedImageFiles,
      shouldHideCroppedPreviews,
    } = this.state;

    const downloadName = getDownloadName(uploadedFileName);
    const cropRectangleMetadataDownloadName =
      getCropMetadataDownloadName(uploadedFileName);

    return (
      <div>
        <h1>Autocropper</h1>

        <section>
          <h2>Step 1: Upload and review.</h2>

          {isProcessingFile ? (
            <p>Processing file...</p>
          ) : originalImageFiles.length === 0 ? (
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
              <p>Non-cropped files ({originalImageFiles.length}):</p>

              <label>
                Hide{" "}
                <input
                  type="checkbox"
                  checked={shouldHideOriginalPreviews}
                  onChange={this.onShouldHideOriginalPreviewsChange}
                />
              </label>

              {shouldHideOriginalPreviews ? (
                <p>Hidden.</p>
              ) : (
                <ol>
                  {originalImageFiles.map((file, index) => (
                    <ImagePreview
                      key={file.name}
                      file={file}
                      fileIndex={index}
                    />
                  ))}
                </ol>
              )}
            </>
          )}
        </section>

        <section>
          <h2>(Advanced) Step 2: Select transparent padding.</h2>
          {isValidNonNegativeInteger(transparentPaddingInputValue) ? (
            <p className="BoldFontWeight">
              This step is optional. If you do not understand this step, then
              just skip it.
            </p>
          ) : (
            <p className="BoldFontWeight">
              If you do not understand this step, then just enter "0" below.
            </p>
          )}
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
          px
        </section>

        <section>
          <h2>Step 3: Crop and review.</h2>

          {croppedImageFiles.length === 0 ? (
            <button
              disabled={
                !(
                  originalImageFiles.length > 0 &&
                  isValidNonNegativeInteger(transparentPaddingInputValue)
                )
              }
              onClick={this.onCropButtonClick}
            >
              Crop
            </button>
          ) : (
            <>
              <p>Cropped files ({croppedImageFiles.length}):</p>

              <label>
                Hide{" "}
                <input
                  type="checkbox"
                  checked={shouldHideCroppedPreviews}
                  onChange={this.onShouldHideCroppedPreviewsChange}
                />
              </label>

              {shouldHideCroppedPreviews ? (
                <p>Hidden.</p>
              ) : (
                <ol>
                  {croppedImageFiles.map((file, index) => (
                    <ImagePreview
                      key={file.name}
                      file={file}
                      fileIndex={index}
                    />
                  ))}
                </ol>
              )}
            </>
          )}
        </section>

        <section>
          <h2>Step 4: Download the cropped images.</h2>
          <button
            disabled={croppedImageFiles.length === 0}
            onClick={this.onDownloadButtonClick}
          >
            Download {downloadName}
          </button>
        </section>

        <section>
          <h2>(Advanced) Step 5: Download crop metadata.</h2>
          <p className="BoldFontWeight">
            This step is optional. If you do not understand this step, then just
            skip it.
          </p>

          <button
            disabled={croppedImageFiles.length === 0}
            onClick={this.onDownloadCropMetadataButtonClick}
          >
            Download {cropRectangleMetadataDownloadName}
          </button>

          <p>
            All coordinates in the resulting file are relative to the original
            (non-cropped) image. You can use these coordinates to place the
            cropped image in the same position as the original image.
          </p>
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
      this.setState(
        {
          isProcessingFile: true,
        },
        () => this.onZipFileUpload(file)
      );
      return;
    }

    if (isImageFileName(file.name)) {
      this.setState(
        {
          isProcessingFile: true,
        },
        () => this.onImageFileUpload(file)
      );
      return;
    }

    window.alert("Invalid file type.");
  }

  onZipFileUpload(file: File): void {
    JSZip.loadAsync(file)
      .then(getImageEntries)
      .then((imageEntries) =>
        Promise.all(imageEntries.map(loadImageFileFromZipEntry))
      )
      .then((unsortedImageFiles) => {
        const originalImageFiles = unsortedImageFiles.sort((a, b) =>
          compareStrings(a.name, b.name)
        );
        this.setState({
          isProcessingFile: false,
          uploadedFileName: file.name,
          originalImageFiles,
          croppedImageFiles: [],
        });
      });
  }

  onImageFileUpload(file: File): void {
    file
      .arrayBuffer()
      .then((buffer) => loadImageFileFromArrayBuffer(buffer, file.name))
      .then((imageFile) => {
        this.setState({
          isProcessingFile: false,
          uploadedFileName: file.name,
          originalImageFiles: [imageFile],
          croppedImageFiles: [],
        });
      });
  }

  onShouldHideOriginalPreviewsChange(
    event: React.ChangeEvent<HTMLInputElement>
  ): void {
    this.setState({
      shouldHideOriginalPreviews: event.target.checked,
    });
  }

  onShouldHideCroppedPreviewsChange(
    event: React.ChangeEvent<HTMLInputElement>
  ): void {
    this.setState({
      shouldHideCroppedPreviews: event.target.checked,
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
    const { originalImageFiles, transparentPaddingInputValue } = this.state;

    if (
      !(
        originalImageFiles.length > 0 &&
        isValidNonNegativeInteger(transparentPaddingInputValue)
      )
    ) {
      return;
    }

    const transparentPadding = Number.parseInt(
      transparentPaddingInputValue,
      10
    );

    cropImagesAndAddPadding(originalImageFiles, transparentPadding).then(
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

    const downloadName = getDownloadName(uploadedFileName);

    // If the original file was an image file (not a zip file),
    // then download an image file (instead of a zip file).
    if (isImageFileName(uploadedFileName)) {
      const [file] = croppedImageFiles;

      getImageFileBuffer(file).then((buffer) => {
        const dotlessExtension = getDotlessExtension(uploadedFileName);
        const mimeType = "image/" + dotlessExtension.toLowerCase();
        const blob = new Blob([buffer], { type: mimeType });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = downloadName;
        a.click();
      });

      return;
    }

    const zipped = zipImageFiles(croppedImageFiles);

    downloadZipFile(zipped, downloadName);
  }

  onDownloadCropMetadataButtonClick(): void {
    const { uploadedFileName, croppedImageFiles, originalImageFiles } =
      this.state;

    if (croppedImageFiles.length === 0) {
      return;
    }

    const downloadName = getCropMetadataDownloadName(uploadedFileName);

    // We need to get the crop metadata from the original image files,
    // since it's not particularly useful to download the crop metadata of the cropped files.
    const cropMetadataString = getCropMetadataString(originalImageFiles);

    const blob = new Blob([cropMetadataString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = downloadName;
    a.click();
  }
}

function ImagePreview({
  file,
  fileIndex,
}: {
  readonly file: ImageFile;
  readonly fileIndex: number;
}): React.ReactElement {
  return (
    <li className="PreviewContainer">
      <span className="PreviewName">
        {fileIndex + 1}. {file.name} ({file.width}x{file.height})
      </span>
      <img className="PreviewImage" src={file.url} alt={file.name} />
    </li>
  );
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

function loadImageFileFromZipEntry(
  zipEntry: JSZip.JSZipObject
): Promise<ImageFile> {
  return zipEntry
    .async("arraybuffer")
    .then((buffer) => loadImageFileFromArrayBuffer(buffer, zipEntry.name));
}

function loadImageFileFromArrayBuffer(
  buffer: ArrayBuffer,
  imageName: string
): Promise<ImageFile> {
  const dotlessExtension = getDotlessExtension(imageName);
  if (!isImageFileName("test." + dotlessExtension)) {
    throw new Error("Invalid image file type. Name: " + imageName);
  }

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
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

      const cropBounds = getCropBounds(imageData);

      canvas.toBlob((blob) => {
        if (blob === null) {
          const error = new Error("Failed to create blob for " + imageName);
          reject(error);
          throw error;
        }

        const url = URL.createObjectURL(blob);

        resolve({
          name: imageName,
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
  files: readonly ImageFile[],
  transparentPadding: number
): Promise<readonly ImageFile[]> {
  return Promise.all(
    files.map((f) => cropImageAndAddPadding(f, transparentPadding))
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

function zipImageFiles(files: readonly ImageFile[]): JSZip {
  const zip = new JSZip();

  for (const file of files) {
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

function compareStrings(a: string, b: string): number {
  if (a < b) {
    return -1;
  }

  if (a > b) {
    return 1;
  }

  return 0;
}

function getDownloadName(uploadedFileName: string): string {
  const dotlessExtension = getDotlessExtension(uploadedFileName);
  return uploadedFileName.replace(
    /\.[^.]+$/,
    ".cropped." + dotlessExtension.toLowerCase()
  );
}

function getCropMetadataDownloadName(uploadedFileName: string): string {
  return uploadedFileName.replace(/\.[^.]+$/, ".crop_metadata.json");
}

function getCropMetadataString(files: readonly ImageFile[]): string {
  const sortedFiles: readonly ImageFile[] = files
    .slice()
    .sort((a, b) => compareStrings(a.name, b.name));

  const out = sortedFiles.map((file) => {
    const { name, width, height, cropBounds } = file;
    return { name, width, height, ...cropBounds };
  });

  return JSON.stringify(out, null, 4);
}

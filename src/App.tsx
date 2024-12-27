import { Component, ReactNode } from "react";
import JSZip from "jszip";

interface State {
  readonly imageFiles: readonly ImageFile[];
}

interface ImageFile {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
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
      imageFiles: [],
    };

    this.bindMethods();
  }

  bindMethods(): void {
    this.onFileInputChange = this.onFileInputChange.bind(this);
  }

  render(): ReactNode {
    return (
      <div>
        <h1>Autocropper</h1>

        <p>Upload an image or zip file.</p>
        <p>Files with names that start with a "." will be ignored.</p>

        <input
          type="file"
          accept={[".zip"].concat(IMAGE_EXTENSIONS).join(",")}
          onChange={this.onFileInputChange}
        />
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
          imageFiles,
        });

        console.log(imageFiles);
      });
  }

  onImageFileUpload(file: File): void {
    // TODO
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
  const dotlessExtension = zipEntry.name.toLowerCase().split(".").pop()!;
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

        resolve({
          name: zipEntry.name,
          width: canvas.width,
          height: canvas.height,
          data: imageData.data,
          cropBounds,
        });
      });

      image.addEventListener("error", reject);
    });

    image.src = url;

    return out;
  });
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

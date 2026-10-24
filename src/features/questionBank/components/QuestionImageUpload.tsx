import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import toast from "react-hot-toast";
import styles from "./QuestionImageUpload.module.css";
import { Spinner } from "@/components/ui/Spinner";
import { IconUpload, IconClose } from "@/assets/icons";
import { api } from "@/utils/api";
import { API_ENDPOINTS } from "@/constants/api";
import { clsx } from "@/utils/helpers";

const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp,image/gif";

interface UploadedImage {
  image_key: string;
  image_url: string | null;
}

export interface QuestionImageUploadHandle {
  open: () => void;
}

interface QuestionImageUploadProps {
  categoryId: string;
  imageUrl?: string | null;
  size?: "md" | "sm";
  /** Hide the visible trigger — another control calls `open()` via ref instead. */
  hideTrigger?: boolean;
  /** Disable only the "Add image" trigger — an existing image can still be removed. */
  disabled?: boolean;
  onUploaded: (image: UploadedImage) => void;
  onRemove: () => void;
}

export const QuestionImageUpload = forwardRef<QuestionImageUploadHandle, QuestionImageUploadProps>(
  function QuestionImageUpload(
    {
      categoryId,
      imageUrl,
      size = "md",
      hideTrigger = false,
      disabled = false,
      onUploaded,
      onRemove,
    },
    ref
  ) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    useImperativeHandle(ref, () => ({
      open: () => {
        if (!disabled) inputRef.current?.click();
      },
    }));

    const handleFile = async (file: File) => {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);
      try {
        const { data } = await api.post(
          API_ENDPOINTS.CATEGORIES.UPLOAD_IMAGE(categoryId),
          formData,
          { headers: { "Content-Type": "multipart/form-data" } }
        );
        onUploaded({ image_key: data.data.image_key, image_url: data.data.image_url });
      } catch {
        toast.error("Failed to upload image");
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    };

    const fileInput = (
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files?.[0]) handleFile(e.target.files[0]);
        }}
      />
    );

    if (imageUrl) {
      return (
        <div className={clsx(styles.preview, size === "sm" && styles.previewSm)}>
          {fileInput}
          <img src={imageUrl} alt="" className={styles.previewImg} />
          <button
            type="button"
            className={styles.removeBtn}
            onClick={onRemove}
            aria-label="Remove image"
          >
            <IconClose size={11} />
          </button>
        </div>
      );
    }

    if (uploading) {
      return (
        <span className={styles.uploadingIndicator}>
          {fileInput}
          <Spinner size="sm" />
        </span>
      );
    }

    if (hideTrigger) return fileInput;

    return (
      <>
        {fileInput}
        <button
          type="button"
          className={clsx(styles.uploadBtn, size === "sm" && styles.uploadBtnSm)}
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          title={disabled ? "Remove the option's text first to add an image" : undefined}
          aria-label="Add image"
        >
          <IconUpload size={size === "sm" ? 13 : 14} />
          {size !== "sm" && <span>Add image</span>}
        </button>
      </>
    );
  }
);

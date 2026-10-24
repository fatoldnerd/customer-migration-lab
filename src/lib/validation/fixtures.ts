/** A valid 1×1 JPEG used by validation checks and tests (synthetic). */
export const TINY_JPEG_DATA_URL =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

/** Declares PNG but contains plain text: must be rejected by magic-byte checks. */
export const MISLABELLED_DATA_URL = `data:image/png;base64,${btoa('this is not an image, just text')}`;

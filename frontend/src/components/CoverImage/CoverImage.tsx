import type { CoverImageProps } from "../../types/alltypes"
export default function CoverImage({ src, alt }: CoverImageProps) {
    const defaultCoverImage = "../../assets/images/audioimg.png";
    if (!src) {
        return (
            <div className="cover-placeholder">
                <img src={defaultCoverImage} alt="播放器" className="placeholder-image" />
            </div>
        )
    }
    else {
        return (
            <div className="cover-container">
                <img src={src} alt={alt} className="cover-image" />
            </div>
        )
    }
}
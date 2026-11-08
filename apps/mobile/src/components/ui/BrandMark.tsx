import { Image } from 'expo-image'

/** The Track.now mark (the app icon artwork), for auth screens and headers. */
export function BrandMark({ size = 44 }: { size?: number }) {
  return (
    <Image
      source={require('../../../assets/images/icon.png')}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.23), alignSelf: 'center' }}
      contentFit="cover"
      accessibilityIgnoresInvertColors
      accessible={false}
    />
  )
}

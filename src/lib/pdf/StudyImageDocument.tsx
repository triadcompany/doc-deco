import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';

const MUTED_FOREGROUND = 'hsl(220, 10%, 45%)';
const MUTED_BG = 'hsl(220, 15%, 94%)';
const FOREGROUND = 'hsl(220, 25%, 10%)';

const styles = StyleSheet.create({
  page: { paddingTop: 48, paddingBottom: 48, paddingHorizontal: 44, fontFamily: 'Helvetica', color: FOREGROUND },
  title: { fontSize: 20, fontWeight: 700, marginBottom: 4 },
  docBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 4 },
  docBadge: { fontSize: 8, color: MUTED_FOREGROUND, backgroundColor: MUTED_BG, borderRadius: 3, paddingVertical: 2, paddingHorizontal: 6, marginRight: 4 },
  meta: { fontSize: 9, color: MUTED_FOREGROUND, marginBottom: 18 },
  emptyNote: { fontSize: 11, color: MUTED_FOREGROUND, fontStyle: 'italic', marginTop: 20 },
});

interface Props {
  title: string;
  documentTitles: string[];
  updatedAtLabel: string;
  /** data URL PNG of the captured mind map, or null when capture failed/was empty. */
  imageDataUrl: string | null;
  /** intrinsic pixel size of the captured image, used to fit it within one page. */
  imageSize: { width: number; height: number } | null;
}

// A4 content box at the padding used above (points).
const MAX_WIDTH_PT = 595.28 - 44 * 2;
const MAX_HEIGHT_PT = 841.89 - 48 * 2 - 60; // minus header block

export function StudyImageDocument({ title, documentTitles, updatedAtLabel, imageDataUrl, imageSize }: Props) {
  let imgStyle: { width: number; height: number } | undefined;
  if (imageDataUrl && imageSize && imageSize.width > 0 && imageSize.height > 0) {
    const scale = Math.min(MAX_WIDTH_PT / imageSize.width, MAX_HEIGHT_PT / imageSize.height, 1);
    imgStyle = { width: imageSize.width * scale, height: imageSize.height * scale };
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        {documentTitles.length > 0 && (
          <View style={styles.docBadges}>
            {documentTitles.map((t, i) => (
              <Text key={i} style={styles.docBadge}>{t}</Text>
            ))}
          </View>
        )}
        <Text style={styles.meta}>Atualizado em {updatedAtLabel}</Text>
        {imageDataUrl && imgStyle ? (
          <Image src={imageDataUrl} style={imgStyle} />
        ) : (
          <Text style={styles.emptyNote}>Mapa mental vazio</Text>
        )}
      </Page>
    </Document>
  );
}

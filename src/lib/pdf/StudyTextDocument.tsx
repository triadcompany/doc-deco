import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { PdfBlock, PdfTextRun } from '@/lib/html-to-pdf-nodes';

const PRIMARY = 'hsl(38, 92%, 50%)';
const MUTED_FOREGROUND = 'hsl(220, 10%, 45%)';
const MUTED_BG = 'hsl(220, 15%, 94%)';
const FOREGROUND = 'hsl(220, 25%, 10%)';

const styles = StyleSheet.create({
  page: { paddingTop: 48, paddingBottom: 48, paddingHorizontal: 44, fontFamily: 'Helvetica', color: FOREGROUND },
  title: { fontSize: 20, fontWeight: 700, marginBottom: 4 },
  docBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 4 },
  docBadge: { fontSize: 8, color: MUTED_FOREGROUND, backgroundColor: MUTED_BG, borderRadius: 3, paddingVertical: 2, paddingHorizontal: 6, marginRight: 4 },
  meta: { fontSize: 9, color: MUTED_FOREGROUND, marginBottom: 18 },
  heading1: { fontSize: 18, fontWeight: 700, marginTop: 12, marginBottom: 6 },
  heading2: { fontSize: 14, fontWeight: 700, marginTop: 10, marginBottom: 5 },
  paragraph: { fontSize: 11, lineHeight: 1.5, marginBottom: 7 },
  quote: { borderLeftWidth: 2.5, borderLeftColor: PRIMARY, backgroundColor: MUTED_BG, borderRadius: 3, paddingVertical: 6, paddingHorizontal: 10, marginBottom: 8 },
});

interface Props {
  title: string;
  documentTitles: string[];
  updatedAtLabel: string;
  blocks: PdfBlock[];
}

function renderRuns(runs: PdfTextRun[], keyPrefix: string) {
  return runs.map((run, i) => (
    <Text
      key={`${keyPrefix}-${i}`}
      style={{
        fontWeight: run.bold ? 700 : 400,
        fontStyle: run.italic ? 'italic' : 'normal',
        color: run.color,
        fontSize: run.fontSize,
        fontFamily: run.fontFamily,
      }}
    >
      {run.text}
    </Text>
  ));
}

function renderBlocks(blocks: PdfBlock[], keyPrefix: string) {
  return blocks.map((block, i) => {
    const key = `${keyPrefix}-${i}`;
    if (block.type === 'quote') {
      return (
        <View key={key} style={styles.quote} wrap={false}>
          {renderBlocks(block.blocks, key)}
        </View>
      );
    }
    const style = block.type === 'heading1' ? styles.heading1 : block.type === 'heading2' ? styles.heading2 : styles.paragraph;
    return (
      <Text key={key} style={style}>
        {renderRuns(block.runs, key)}
      </Text>
    );
  });
}

export function StudyTextDocument({ title, documentTitles, updatedAtLabel, blocks }: Props) {
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
        {renderBlocks(blocks, 'b')}
      </Page>
    </Document>
  );
}

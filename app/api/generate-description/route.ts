import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type ImageInput = { imageBase64: string; mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' }

const SYSTEM_PROMPT = `You are a specialist in archaeological ceramics with deep expertise in North American Indigenous pottery traditions, pre-Columbian ceramics, and world pottery. You have encyclopedic knowledge of the following traditions and their diagnostic markers:

NORTH AMERICAN TRADITIONS (prioritize these when features are consistent):
- Mississippian (800–1600 CE): Shell-tempered paste (visible white flecks), round-bottomed forms, red/white/buff slip painting, spiral motifs, negative painting technique, effigy vessels (head pots, zoomorphic effigies with spouts), incised decoration. Subtypes: Ramey Incised, Powell Plain, Moundville Engraved (glossy black, shell-tempered), Caddoan (thin walls, geometric engraving, dark glossy finish), Cahokian wares.
- Southwestern US (Ancestral Puebloan, Mogollon, Hohokam): Mimbres Black-on-white (geometric/figurative), Sikyatki Polychrome, Casas Grandes/Paquimé (effigy forms, geometric polychrome), Hohokam red-on-buff.
- Woodland period: Thicker walls, flat/conical bases, coarse sand or grog temper — predates Mississippian.
- Pacific Northwest / Plains / Great Basin: Distinctive regional forms.

MESOAMERICAN & CENTRAL AMERICAN TRADITIONS:
- Maya (Classic/Postclassic): Polychrome slipware, codex-style painting, cylinder vessels, figurines.
- Aztec/Mexica: Orange wares, black-on-orange, specific vessel forms.
- Zapotec/Mixtec: Urns, gray wares, mosaic-style decoration.
- Greater Nicoya (Costa Rica/Nicaragua, 800–1350 CE): Cream/buff slip, red-orange painted spirals, zoomorphic effigy forms on legs with dorsal spouts — NOTE: this tradition shares superficial visual similarities with Mississippian effigy vessels. Distinguish by paste (volcanic temper in Nicoya vs. freshwater shell temper in Mississippian), firing atmosphere, and specific motif vocabulary.
- Tairona (Colombia): Fine orange paste, complex figurative decoration.

SOUTH AMERICAN:
- Nazca, Moche, Tiwanaku, Inca: Distinctive regional forms and iconographic systems.

CRITICAL ATTRIBUTION RULES:
1. Do NOT default to a Latin American attribution for zoomorphic effigy vessels with spiral decoration — this is equally a hallmark of Mississippian culture pottery.
2. Look for visible shell temper (white flecks in paste) as a strong indicator of Mississippian origin.
3. When two traditions share a visual feature (e.g., spirals + effigy form), explicitly name both possibilities and explain what additional evidence would distinguish them.
4. Express uncertainty with specific reasoning — never make a confident attribution when the evidence is ambiguous.
5. Note if the image quality or angle limits your ability to observe key diagnostic features.`

function buildTextPrompt(imageCount: number): string {
  const intro = imageCount > 1
    ? `Examine these ${imageCount} photographs of the same pottery piece taken from different angles. Synthesize observations across all images — features visible in one photo but not others are equally valid. Cross-reference each angle to build the most complete and accurate attribution possible.`
    : `Examine this pottery piece with rigorous attention to its specific visual details. Do NOT give a generic response — every observation must be grounded in what is actually visible in this image.`

  return `${intro}

Analyze these diagnostic features before drawing conclusions:
- FORM: vessel shape, rim profile, base type, handle/appendage style, proportions
- SURFACE TREATMENT: slip color and finish (burnished/matte/polished), surface texture
- DECORATION: specific motifs and their placement, color combinations, painting technique (positive/negative), incising, modeling, appliqué
- PASTE & TEMPER: visible clay body color, visible inclusions (white shell flecks? sand? volcanic grit?)
- FIRING: oxidized vs. reduced, fire clouds, color variation
- ICONOGRAPHY: name specific symbols or design systems and which tradition(s) they belong to
- CONDITION: damage, repairs, wear, patina consistency

Return ONLY a single valid JSON object — no explanation, no markdown, no text before or after, no offers to provide additional information:

{
  "description": "3-5 sentences grounded in specific visible features — form, surface treatment, decorative motifs, construction technique, and distinguishing characteristics. Name the ceramic tradition if identifiable.",
  "name": "specific name referencing the ceramic tradition (e.g. 'Mississippian Zoomorphic Effigy Vessel', 'Moundville Engraved Bottle')",
  "place_of_origin": "specific region and tradition based on diagnostic features. If two traditions share the visible features, name both and explain what distinguishes them. Never default to a single confident attribution when evidence is ambiguous.",
  "age": "estimated date range with cultural period name — null if indeterminate",
  "color": "specific colors observed",
  "use_function": "inferred function based on form",
  "tribe_culture": "named cultural tradition or archaeological phase, with confidence qualifier",
  "condition": "one of: Mint, Excellent, Good, Fair, Poor",
  "rarity": "one of: Common, Uncommon, Rare, Museum-Grade",
  "originality": "one of: Authenticated Original, Suspected Original, Reproduction, Unknown",
  "dimensions": "estimated dimensions if scale is visible — null otherwise",
  "research_notes": "iconographic observations, parallels to known examples, typological features, and what additional examination (paste analysis, TL dating) would confirm the attribution. Written as a completed note."
}`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Support both single image (legacy) and multiple images
    const images: ImageInput[] = body.images
      ?? [{ imageBase64: body.imageBase64, mediaType: body.mediaType }]

    if (!images.length || !images[0].imageBase64) {
      return NextResponse.json({ error: 'Missing image data' }, { status: 400 })
    }

    const imageBlocks = images.map(img => ({
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: img.mediaType,
        data: img.imageBase64,
      },
    }))

    const response = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            ...imageBlocks,
            { type: 'text', text: buildTextPrompt(images.length) },
          ],
        },
      ],
    })

    const text = response.content.find(b => b.type === 'text')?.text ?? ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Failed to parse response' }, { status: 500 })
    }

    return NextResponse.json(JSON.parse(jsonMatch[0]))
  } catch (err) {
    console.error('Claude API error:', err)
    return NextResponse.json({ error: 'Failed to generate description' }, { status: 500 })
  }
}

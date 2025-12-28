import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {makeDocsApiCall} from '../utils/docs-api.js';
import {jsonResult} from '../utils/response.js';
import {strictSchemaWithAliases} from '../utils/schema.js';

// Location specification for insertions
const locationSchema = z.object({
	index: z.number().describe('The zero-based index in the document'),
	segmentId: z.string().optional().describe('The ID of the header, footer, or footnote. Empty for body.'),
	tabId: z.string().optional().describe('The tab ID containing the location'),
});

// Range specification for modifications
const rangeSchema = z.object({
	startIndex: z.number().describe('The zero-based start index'),
	endIndex: z.number().describe('The zero-based end index (exclusive)'),
	segmentId: z.string().optional().describe('The ID of the header, footer, or footnote. Empty for body.'),
	tabId: z.string().optional().describe('The tab ID containing the range'),
});

// SubstringMatchCriteria for find/replace
const substringMatchCriteriaSchema = z.object({
	text: z.string().describe('The text to search for'),
	matchCase: z.boolean().optional().describe('Whether the search is case-sensitive'),
});

// Dimension specification for tables
const dimensionSchema = z.object({
	magnitude: z.number().describe('The magnitude'),
	unit: z.enum(['UNIT_UNSPECIFIED', 'PT']).default('PT').describe('The unit of measurement'),
});

// Table cell location
const tableCellLocationSchema = z.object({
	tableStartLocation: locationSchema.describe('Location where the table begins'),
	rowIndex: z.number().describe('The zero-based row index'),
	columnIndex: z.number().describe('The zero-based column index'),
});

// Individual request types
const insertTextRequestSchema = z.object({
	insertText: z.object({
		text: z.string().describe('The text to insert'),
		location: locationSchema.optional().describe('Insert at this location'),
		endOfSegmentLocation: z.object({
			segmentId: z.string().optional(),
			tabId: z.string().optional(),
		}).optional().describe('Insert at end of segment'),
	}),
});

const deleteContentRangeRequestSchema = z.object({
	deleteContentRange: z.object({
		range: rangeSchema.describe('The range to delete'),
	}),
});

const replaceAllTextRequestSchema = z.object({
	replaceAllText: z.object({
		containsText: substringMatchCriteriaSchema.describe('Text to find'),
		replaceText: z.string().describe('Replacement text'),
		tabsCriteria: z.object({
			tabIds: z.array(z.string()).optional(),
		}).optional().describe('Which tabs to search'),
	}),
});

const insertInlineImageRequestSchema = z.object({
	insertInlineImage: z.object({
		uri: z.string().describe('The image URI'),
		location: locationSchema.optional().describe('Insert at this location'),
		endOfSegmentLocation: z.object({
			segmentId: z.string().optional(),
			tabId: z.string().optional(),
		}).optional().describe('Insert at end of segment'),
		objectSize: z.object({
			height: dimensionSchema.optional(),
			width: dimensionSchema.optional(),
		}).optional().describe('The size of the image'),
	}),
});

const insertTableRequestSchema = z.object({
	insertTable: z.object({
		rows: z.number().describe('Number of rows'),
		columns: z.number().describe('Number of columns'),
		location: locationSchema.optional().describe('Insert at this location'),
		endOfSegmentLocation: z.object({
			segmentId: z.string().optional(),
			tabId: z.string().optional(),
		}).optional().describe('Insert at end of segment'),
	}),
});

const insertTableRowRequestSchema = z.object({
	insertTableRow: z.object({
		tableCellLocation: tableCellLocationSchema.describe('Reference cell location'),
		insertBelow: z.boolean().optional().describe('Insert below the reference row'),
	}),
});

const insertTableColumnRequestSchema = z.object({
	insertTableColumn: z.object({
		tableCellLocation: tableCellLocationSchema.describe('Reference cell location'),
		insertRight: z.boolean().optional().describe('Insert to the right of the reference column'),
	}),
});

const deleteTableRowRequestSchema = z.object({
	deleteTableRow: z.object({
		tableCellLocation: tableCellLocationSchema.describe('Cell in row to delete'),
	}),
});

const deleteTableColumnRequestSchema = z.object({
	deleteTableColumn: z.object({
		tableCellLocation: tableCellLocationSchema.describe('Cell in column to delete'),
	}),
});

const insertPageBreakRequestSchema = z.object({
	insertPageBreak: z.object({
		location: locationSchema.optional().describe('Insert at this location'),
		endOfSegmentLocation: z.object({
			segmentId: z.string().optional(),
			tabId: z.string().optional(),
		}).optional().describe('Insert at end of segment'),
	}),
});

const createNamedRangeRequestSchema = z.object({
	createNamedRange: z.object({
		name: z.string().describe('Name for the range'),
		range: rangeSchema.describe('The range to name'),
	}),
});

const deleteNamedRangeRequestSchema = z.object({
	deleteNamedRange: z.object({
		namedRangeId: z.string().optional().describe('ID of named range to delete'),
		name: z.string().optional().describe('Name of range to delete'),
	}),
});

const createParagraphBulletsRequestSchema = z.object({
	createParagraphBullets: z.object({
		range: rangeSchema.describe('Range of paragraphs to bullet'),
		bulletPreset: z.enum([
			'BULLET_DISC_CIRCLE_SQUARE',
			'BULLET_DIAMONDX_ARROW3D_SQUARE',
			'BULLET_CHECKBOX',
			'BULLET_ARROW_DIAMOND_DISC',
			'BULLET_STAR_CIRCLE_SQUARE',
			'BULLET_ARROW3D_CIRCLE_SQUARE',
			'BULLET_LEFTTRIANGLE_DIAMOND_DISC',
			'NUMBERED_DECIMAL_ALPHA_ROMAN',
			'NUMBERED_DECIMAL_ALPHA_ROMAN_PARENS',
			'NUMBERED_DECIMAL_NESTED',
			'NUMBERED_UPPERALPHA_ALPHA_ROMAN',
			'NUMBERED_UPPERROMAN_UPPERALPHA_DECIMAL',
			'NUMBERED_ZERODECIMAL_ALPHA_ROMAN',
		]).optional().describe('The bullet preset'),
	}),
});

const deleteParagraphBulletsRequestSchema = z.object({
	deleteParagraphBullets: z.object({
		range: rangeSchema.describe('Range of paragraphs to remove bullets from'),
	}),
});

// Union of all request types
const requestSchema = z.union([
	insertTextRequestSchema,
	deleteContentRangeRequestSchema,
	replaceAllTextRequestSchema,
	insertInlineImageRequestSchema,
	insertTableRequestSchema,
	insertTableRowRequestSchema,
	insertTableColumnRequestSchema,
	deleteTableRowRequestSchema,
	deleteTableColumnRequestSchema,
	insertPageBreakRequestSchema,
	createNamedRangeRequestSchema,
	deleteNamedRangeRequestSchema,
	createParagraphBulletsRequestSchema,
	deleteParagraphBulletsRequestSchema,
]);

const inputSchema = strictSchemaWithAliases(
	{
		documentId: z.string().describe('The ID of the document to update'),
		requests: z.array(requestSchema).describe('The list of update requests to apply. All requests in a batch are applied atomically.'),
	},
	{},
);

const outputSchema = z.object({
	documentId: z.string(),
	replies: z.array(z.unknown()).optional(),
	writeControl: z.object({
		requiredRevisionId: z.string().optional(),
	}).optional(),
}).passthrough();

export function registerDocumentBatchUpdate(server: McpServer, config: Config): void {
	server.registerTool(
		'document_batch_update',
		{
			title: 'Batch update document',
			description: 'Apply one or more updates to a Google Doc. Supports inserting/deleting text, find/replace, inserting images and tables, managing bullets, and more. All requests are applied atomically - if any fails, none are applied.',
			inputSchema,
			outputSchema,
		},
		async ({documentId, requests}) => {
			const result = await makeDocsApiCall('POST', `/documents/${documentId}:batchUpdate`, config.token, {requests});
			return jsonResult(outputSchema.parse(result));
		},
	);
}

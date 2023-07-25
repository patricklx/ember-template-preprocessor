import parseStaticImports from 'parse-static-imports';
import traverse, { NodePath } from '@babel/traverse';

import { Identifier } from '@babel/types';
import { TEMPLATE_TAG_NAME, } from './util';
import parse, { EmberNode } from './template-parser';
import * as b from '@babel/types';

export type TemplateMatch = TemplateTagMatch | TemplateLiteralMatch;

export type Match = { start: number; end: number };

export interface TemplateTagMatch {
  type: 'template-tag';
  tagName: string;
  startRange: Match;
  endRange: Match;
  contents: string;
  contentRange: [number, number];
  range: [number, number];
  prefix?: string;
}

export interface TemplateLiteralMatch {
  type: 'template-literal';
  tagName: string;
  contents: string;
  startRange: Match;
  endRange: Match;
  contentRange: [number, number];
  range: [number, number];
  importPath: string;
  importIdentifier: string;
  prefix?: string;
}

export function isTemplateLiteralMatch(
    template: TemplateTagMatch | TemplateLiteralMatch
): template is TemplateLiteralMatch {
  return template.type === 'template-literal';
}

/**
 * Represents a static import of a template literal.
 */
export interface StaticImportConfig {
  /**
   * The path to the package from which we want to import the template literal
   * (e.g.: 'ember-cli-htmlbars')
   */
  importPath: string;
  /**
   * The name of the template literal (e.g.: 'hbs') or 'default' if this package
   * exports a default function
   */
  importIdentifier: string;
}

/**
 * The input options to instruct parseTemplates on how to parse the input.
 *
 * @param templateTag
 * @param templateLiteral
 */
export interface ParseTemplatesOptions {
  /** Tag to use, if parsing template tags is enabled. */
  templateTag?: string;
  /** Which static imports are expected in this template. */
  templateLiteral?: StaticImportConfig[];
}

function replaceRange(
    s: string,
    start: number,
    end: number,
    substitute: string
) {
  return s.substring(0, start) + substitute + s.substring(end);
}

export const DEFAULT_PARSE_TEMPLATES_OPTIONS = {
  templateTag: TEMPLATE_TAG_NAME
};

/**
 * Parses a template to find all possible valid matches for an embedded template.
 * Supported syntaxes are template literals:
 *
 *   hbs`Hello, world!`
 *
 * And template tags
 *
 *   <template></template>
 *
 * The parser excludes any values found within strings recursively, and also
 * excludes any string literals with dynamic segments (e.g `${}`) since these
 * cannot be valid templates.
 *
 * @param template The template to parse
 * @param relativePath Relative file path for the template (for errors)
 * @param options optional configuration options for how to parse templates
 * @returns
 */
export function parseTemplates(
    template: string,
    relativePath: string,
    options: ParseTemplatesOptions = DEFAULT_PARSE_TEMPLATES_OPTIONS
) {
  const results: TemplateMatch[] = [];
  const templateTag = options?.templateTag;

  const ast = parse(template,
      {
        ranges: true,
        allowImportExportEverywhere: true,
        errorRecovery: true,
        templateTag,
        plugins: ['typescript', 'decorators'],
      }
  );

  b.TYPES.push('EmberTemplate');


  traverse(ast, {
    // @ts-ignore
    EmberTemplate(path: NodePath<EmberNode>) {
      const node = path.node;

      results.push({
        type: 'template-tag',
        tagName: node.tagName,
        contents: node.contentNode.value,
        contentRange: node.contentNode.range as [number, number],
        range: node.range!!,
        startRange: {
          start: node.startRange[0],
          end: node.startRange[1],
        },
        endRange: { start: node.endRange[0], end: node.endRange[1] },
      });
    }
  });
  return { results, ast };
}
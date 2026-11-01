import path from 'node:path';
import type { Rule } from 'eslint';
import type { Node as EstreeNode } from 'estree';
import ts from 'typescript';
import { LITERAL_HOME_FILES, TEST_FILE_SUFFIXES, STRICT_DIRECTIVE, TYPEOF_OPERATOR, TS_NODE_PREFIX, MESSAGE_ID } from './constants.ts';
import { TEXT } from './text.ts';

type ParentedNode = EstreeNode & { parent?: ParentedNode };

const isLiteralHome = (fileName: string): boolean => {
  const baseName = path.basename(fileName);
  return LITERAL_HOME_FILES.has(baseName) || TEST_FILE_SUFFIXES.some((suffix) => baseName.endsWith(suffix));
};

const isModuleSpecifier = (parent: ParentedNode | undefined): boolean => parent !== undefined && (
  parent.type === 'ImportDeclaration'
  || parent.type === 'ExportNamedDeclaration'
  || parent.type === 'ExportAllDeclaration'
  || parent.type === 'ImportExpression'
);

const isPropertyKey = (node: ParentedNode, parent: ParentedNode | undefined): boolean => parent !== undefined
  && (parent.type === 'Property' || parent.type === 'PropertyDefinition' || parent.type === 'MethodDefinition')
  && parent.key === node && !parent.computed;

const isTypeofComparison = (node: ParentedNode, parent: ParentedNode | undefined): boolean => {
  if (parent?.type !== 'BinaryExpression') return false;
  const other = parent.left === node ? parent.right : parent.left;
  return other.type === 'UnaryExpression' && other.operator === TYPEOF_OPERATOR;
};

const isInTypePosition = (parent: ParentedNode | undefined): boolean => {
  const parentType = String(parent?.type ?? '');
  return parentType.startsWith(TS_NODE_PREFIX);
};

type TypeServices = {
  program: ts.Program;
  esTreeNodeToTSNodeMap: { get(node: unknown): ts.Node };
};

const typeServicesOf = (context: Rule.RuleContext): TypeServices | null => {
  const services = context.sourceCode.parserServices as Partial<TypeServices> | undefined;
  return services?.program && services.esTreeNodeToTSNodeMap ? services as TypeServices : null;
};

const isStringLiteralUnion = (type: ts.Type | undefined): boolean => {
  if (!type) return false;
  const members = type.isUnion() ? type.types : [type];
  const stringMembers = members.filter((member) => (member.flags & ts.TypeFlags.StringLike) !== 0);
  return stringMembers.length > 0 && stringMembers.every((member) => member.isStringLiteral());
};

const isCheckedByCompiler = (node: ParentedNode, parent: ParentedNode | undefined, services: TypeServices | null): boolean => {
  if (!services) return false;
  const checker = services.program.getTypeChecker();
  const tsNode = services.esTreeNodeToTSNodeMap.get(node);
  if (ts.isExpression(tsNode) && isStringLiteralUnion(checker.getContextualType(tsNode))) return true;
  if (parent?.type !== 'BinaryExpression') return false;
  const other = parent.left === node ? parent.right : parent.left;
  return isStringLiteralUnion(checker.getTypeAtLocation(services.esTreeNodeToTSNodeMap.get(other)));
};

const isStrictDirective = (value: string, parent: ParentedNode | undefined): boolean => value === STRICT_DIRECTIVE && parent?.type === 'ExpressionStatement';

export const noLiteralStrings: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: { description: TEXT.noLiteralStringsDescription },
    messages: { [MESSAGE_ID.literal]: TEXT.noLiteralStringsMessage },
    schema: [],
  },
  create(context) {
    if (isLiteralHome(context.filename)) return {};
    const services = typeServicesOf(context);
    const reportIfStray = (node: ParentedNode, value: string): void => {
      const parent = node.parent;
      const isExempt = value === ''
        || isModuleSpecifier(parent)
        || isPropertyKey(node, parent)
        || isTypeofComparison(node, parent)
        || isInTypePosition(parent)
        || isStrictDirective(value, parent)
        || isCheckedByCompiler(node, parent, services);
      if (!isExempt) context.report({ node, messageId: MESSAGE_ID.literal, data: { value } });
    };
    return {
      Literal(node) {
        if (typeof node.value === 'string') reportIfStray(node as ParentedNode, node.value);
      },
      TemplateElement(node) {
        const text = node.value.cooked ?? node.value.raw;
        if (text !== '') reportIfStray(node as unknown as ParentedNode, text);
      },
    };
  },
};

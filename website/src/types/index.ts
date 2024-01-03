export interface Doc {
    metadata: Metadata;
    kind: string;
    canonicalReference: string;
    docComment: string;
    name: string;
    preserveMemberOrder: boolean;
    members: DocMember[];
}

export interface DocMember {
    kind: string;
    canonicalReference: string;
    name: string;
    preserveMemberOrder: boolean;
    members: PurpleMember[];
}

export interface PurpleMember {
    kind: string;
    canonicalReference: string;
    docComment: string;
    excerptTokens: ExcerptToken[];
    fileUrlPath: string;
    isReadonly?: boolean;
    releaseTag: ReleaseTag;
    name: string;
    variableTypeTokenRange?: TokenRange;
    isAbstract?: boolean;
    preserveMemberOrder?: boolean;
    members?: FluffyMember[];
    implementsTokenRanges?: TokenRange[];
    extendsTokenRanges?: any[];
}

export interface ExcerptToken {
    kind: ExcerptTokenKind;
    text: string;
    canonicalReference?: string;
}

export type ExcerptTokenKind = "Content" | "Reference";

export interface TokenRange {
    startIndex: number;
    endIndex: number;
}

export interface FluffyMember {
    kind: MemberKind;
    canonicalReference: string;
    docComment: string;
    excerptTokens: ExcerptToken[];
    releaseTag: ReleaseTag;
    isProtected?: boolean;
    overloadIndex?: number;
    parameters?: Parameter[];
    isStatic?: boolean;
    returnTypeTokenRange?: TokenRange;
    isOptional?: boolean;
    isAbstract?: boolean;
    name?: string;
    isReadonly?: boolean;
    propertyTypeTokenRange?: TokenRange;
    initializerTokenRange?: TokenRange;
}

export type MemberKind = "Constructor" | "Method" | "Property" | "PropertySignature" | "EnumMember";

export interface Parameter {
    parameterName: string;
    parameterTypeTokenRange: TokenRange;
    isOptional: boolean;
}

export type ReleaseTag = "Public";

export interface Metadata {
    toolPackage: string;
    toolVersion: string;
    schemaVersion: number;
    oldestForwardsCompatibleVersion: number;
    tsdocConfig: TsdocConfig;
}

export interface TsdocConfig {
    schema: string;
    noStandardTags: boolean;
    tagDefinitions: TagDefinition[];
    supportForTags: { [key: string]: boolean };
    reportUnsupportedHtmlElements: boolean;
}

export interface TagDefinition {
    tagName: string;
    syntaxKind: SyntaxKind;
    allowMultiple?: boolean;
}

export type SyntaxKind = "modifier" | "block" | "inline";

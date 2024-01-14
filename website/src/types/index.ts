import { Dispatch, SetStateAction } from "react";

export type SidebarButton = "class" | "enum";

export interface SidebarProps {
    classes: Class[];
    enums: Enum[];
    open: number;
    setOpen: Dispatch<SetStateAction<number>>;
}

export interface Property {
    id: number;
    name: string;
    variant: string;
    kind: number;
    flags: Flags;
    sources: Source[];
    type: PropertyType;
    comment?: Comment;
    defaultValue?: string;
}

interface PropertyType {
    type: string;
    types?: PropertyType[];
    target?: number;
    name?: string;
    package?: string;
    value?: null;
}

export interface Enum {
    id: number;
    name: string;
    variant: string;
    kind: number;
    flags: Flags;
    children?: EnumChild[];
    groups?: Group[];
    sources: Source[];
    type?: Type;
}

export interface EnumChild {
    id: number;
    name: string;
    variant: string;
    kind: number;
    flags: Flags;
    comment?: Comment;
    sources: Source[];
    type: Type;
}

export interface Flags {
}

export interface Source {
    fileName: string;
    line: number;
    character: number;
    url: string;
}

export interface Type {
    type: string;
    value: number;
}

export interface Class {
    id: number;
    name: string;
    variant: ChildVariant;
    kind: number;
    flags: SignatureFlags;
    comment?: Comment;
    children: Child[];
    groups: Group[];
    sources: Source[];
    extendedTypes?: ExtendedBy[];
    extendedBy?: ExtendedBy[];
    implementedTypes?: ExtendedBy[];
}

export interface Child {
    id: number;
    name: string;
    variant: ChildVariant;
    kind: number;
    flags: ChildFlags;
    sources: Source[];
    signatures?: Signature[];
    type?: ExtendedBy;
    defaultValue?: DefaultValue;
    overwrites?: ExtendedBy;
    inheritedFrom?: ExtendedBy;
    implementationOf?: ExtendedBy;
}

export type DefaultValue = "null";

export interface ChildFlags {
    isPublic?: boolean;
    isReadonly?: boolean;
    isPrivate?: boolean;
}

export interface ExtendedBy {
    type: ExtendedByTypeEnum;
    target?: number;
    name?: string;
    package?: Package;
    types?: TypeElement[];
}

export type Package = "@strafechat/strafe.js" | "typescript";

export type ExtendedByTypeEnum = "reference" | "intrinsic" | "union";

export interface TypeElement {
    type: PurpleType;
    value?: null;
    name?: Name;
    target?: TargetUnion;
    package?: string;
    qualifiedName?: string;
}

export type Name = "string" | "ClientUser" | "number" | "WebSocket" | "Timeout";

export type TargetUnion = TargetClass | number;

export interface TargetClass {
    sourceFileName: string;
    qualifiedName: string;
}

export type PurpleType = "literal" | "intrinsic" | "reference";

export interface Signature {
    id: number;
    name: string;
    variant: SignatureVariant;
    kind: number;
    flags: SignatureFlags;
    sources: Source[];
    type: SignatureType;
    comment?: Comment;
    parameters?: Parameter[];
    overwrites?: ExtendedBy;
}

export interface Comment {
    summary: Summary[];
    blockTags?: BlockTag[];
}

export interface Summary {
    kind: string;
    text: string;
}

export interface BlockTag {
    tag: string;
    content: BlockTagContent[]
}

export interface BlockTagContent {
    kind: string;
    text: string;
}

export interface SignatureFlags {
}

export interface Parameter {
    id: number;
    name: string;
    variant: ParameterVariant;
    kind: number;
    flags: SignatureFlags;
    comment?: Comment;
    type: ExtendedBy;
}

export type ParameterVariant = "param";

export interface SignatureType {
    type: ExtendedByTypeEnum;
    target?: TargetUnion;
    name: string;
    package?: Package;
    typeArguments?: TypeArgument[];
}

export interface TypeArgument {
    type: ExtendedByTypeEnum;
    name: string;
}

export type SignatureVariant = "signature";

export type ChildVariant = "declaration";

export interface Group {
    title: Title;
    children: number[];
}

export type Title = "Constructors" | "Properties" | "Methods";
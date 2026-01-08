declare module 'cytoscape-fcose' {
  import cytoscape from 'cytoscape';

  interface FcoseLayoutOptions extends cytoscape.BaseLayoutOptions {
    name: 'fcose';
    quality?: 'default' | 'draft' | 'proof';
    randomize?: boolean;
    animate?: boolean;
    animationDuration?: number;
    animationEasing?: string;
    fit?: boolean;
    padding?: number;
    nodeDimensionsIncludeLabels?: boolean;
    uniformNodeDimensions?: boolean;
    packComponents?: boolean;
    nodeRepulsion?: number;
    idealEdgeLength?: number;
    edgeElasticity?: number;
    nestingFactor?: number;
    gravity?: number;
    numIter?: number;
    tile?: boolean;
    tilingPaddingVertical?: number;
    tilingPaddingHorizontal?: number;
    gravityRangeCompound?: number;
    gravityCompound?: number;
    gravityRange?: number;
    initialEnergyOnIncremental?: number;
  }

  const fcose: cytoscape.Ext;
  export = fcose;
}

<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor xmlns="http://www.opengis.net/sld" xmlns:se="http://www.opengis.net/se" xmlns:ogc="http://www.opengis.net/ogc" version="1.1.0" xsi:schemaLocation="http://www.opengis.net/sld http://schemas.opengis.net/sld/1.1.0/StyledLayerDescriptor.xsd" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xlink="http://www.w3.org/1999/xlink">
  <NamedLayer>
    <se:Name>Blocks_Sectors</se:Name> <UserStyle>
      <se:Name>Blocks_Sectors_Style</se:Name> <se:FeatureTypeStyle>
        <se:Rule>
          <se:Name>Polygon Border</se:Name>
          <se:MinScaleDenominator>0</se:MinScaleDenominator>
          <se:MaxScaleDenominator>19190</se:MaxScaleDenominator>
          <se:LineSymbolizer>
            <se:Stroke>
              <se:SvgParameter name="stroke">#3579b1</se:SvgParameter>
              <se:SvgParameter name="stroke-width">1</se:SvgParameter>
              <se:SvgParameter name="stroke-linejoin">bevel</se:SvgParameter>
              <se:SvgParameter name="stroke-linecap">square</se:SvgParameter>
            </se:Stroke>
          </se:LineSymbolizer>
        </se:Rule>
        <se:Rule>
          <se:Name>Labels</se:Name>
          <se:TextSymbolizer>
            <se:Label>
                <ogc:Function name="Concatenate">
                    <ogc:PropertyName>village_a</ogc:PropertyName>
                    <ogc:Literal> </ogc:Literal>
                    <ogc:PropertyName>block_no</ogc:PropertyName>
                    <ogc:Literal>&#xa;</ogc:Literal> <ogc:PropertyName>sub_block_no</ogc:PropertyName>
                </ogc:Function>
            </se:Label>
            <se:Font>
              <se:SvgParameter name="font-family">Arial</se:SvgParameter> <se:SvgParameter name="font-size">13</se:SvgParameter>
            </se:Font>
            <se:LabelPlacement>
              <se:PointPlacement>
                <se:AnchorPoint>
                  <se:AnchorPointX>0.5</se:AnchorPointX> <se:AnchorPointY>0.5</se:AnchorPointY> </se:AnchorPoint>
                </se:PointPlacement>
            </se:LabelPlacement>
            <se:Halo>
              <se:Radius>2</se:Radius>
              <se:Fill>
                <se:SvgParameter name="fill">#fad3fa</se:SvgParameter>
              </se:Fill>
            </se:Halo>
            <se:Fill>
              <se:SvgParameter name="fill">#323232</se:SvgParameter>
            </se:Fill>
            <se:VendorOption name="maxDisplacement">100</se:VendorOption> <se:VendorOption name="conflictResolution">true</se:VendorOption> <se:VendorOption name="autoWrap">80</se:VendorOption> <se:VendorOption name="followLine">false</se:VendorOption> <se:VendorOption name="partials">false</se:VendorOption> <se:VendorOption name="labelAllGroup">true</se:VendorOption> <se:VendorOption name="group">true</se:VendorOption> <se:VendorOption name="priority">0</se:VendorOption> </se:TextSymbolizer>
        </se:Rule>
      </se:FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>
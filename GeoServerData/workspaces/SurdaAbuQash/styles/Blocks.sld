<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<StyledLayerDescriptor version="1.0.0" xsi:schemaLocation="http://www.opengis.net/sld StyledLayerDescriptor.xsd" xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <NamedLayer>
    <Name>Blocks</Name>
    <UserStyle>
      <Name>Blocks</Name>
      <Title>Blocks</Title>
      <FeatureTypeStyle>
        <Rule>
          <Name>احواض ابو قش</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>VILLAGE_A</PropertyName>
              <Literal>ابو قش</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>70000</MaxScaleDenominator>
          <LineSymbolizer>
            <Stroke>
              <CssParameter name="stroke">#3579b1</CssParameter>
              <CssParameter name="stroke-width">3</CssParameter>
              <CssParameter name="stroke-linejoin">bevel</CssParameter>
              <CssParameter name="stroke-linecap">square</CssParameter>
            </Stroke>
          </LineSymbolizer>
        </Rule>
        <Rule>
          <Name>احواض صرده</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>VILLAGE_A</PropertyName>
              <Literal>صردا</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>70000</MaxScaleDenominator>
          <LineSymbolizer>
            <Stroke>
              <CssParameter name="stroke">#ad2be0</CssParameter>
              <CssParameter name="stroke-width">3</CssParameter>
              <CssParameter name="stroke-linejoin">bevel</CssParameter>
              <CssParameter name="stroke-linecap">square</CssParameter>
            </Stroke>
          </LineSymbolizer>
        </Rule>
        <Rule>
          <Name>احواض بير زيت</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>VILLAGE_A</PropertyName>
              <Literal>بير زيت</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>70000</MaxScaleDenominator>
          <LineSymbolizer>
            <Stroke>
              <CssParameter name="stroke">#359509</CssParameter>
              <CssParameter name="stroke-width">3</CssParameter>
              <CssParameter name="stroke-linejoin">bevel</CssParameter>
              <CssParameter name="stroke-linecap">square</CssParameter>
            </Stroke>
          </LineSymbolizer>
        </Rule>
        <Rule>
          <Name>احواض البيره</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>VILLAGE_A</PropertyName>
              <Literal>البيره</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>70000</MaxScaleDenominator>
          <LineSymbolizer>
            <Stroke>
              <CssParameter name="stroke">#182bee</CssParameter>
              <CssParameter name="stroke-width">3</CssParameter>
              <CssParameter name="stroke-linejoin">bevel</CssParameter>
              <CssParameter name="stroke-linecap">square</CssParameter>
            </Stroke>
          </LineSymbolizer>
        </Rule>
        <Rule>
          <Name>احواض رام الله</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>VILLAGE_A</PropertyName>
              <Literal>رام الله</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>70000</MaxScaleDenominator>
          <LineSymbolizer>
            <Stroke>
              <CssParameter name="stroke">#e2196b</CssParameter>
              <CssParameter name="stroke-width">3</CssParameter>
              <CssParameter name="stroke-linejoin">bevel</CssParameter>
              <CssParameter name="stroke-linecap">square</CssParameter>
            </Stroke>
          </LineSymbolizer>
        </Rule>
        <Rule>
          <Name>احواض بيتونيا</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>VILLAGE_A</PropertyName>
              <Literal>بيتونيا</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>70000</MaxScaleDenominator>
          <LineSymbolizer>
            <Stroke>
              <CssParameter name="stroke">#3579b1</CssParameter>
              <CssParameter name="stroke-width">3</CssParameter>
              <CssParameter name="stroke-linejoin">bevel</CssParameter>
              <CssParameter name="stroke-linecap">square</CssParameter>
            </Stroke>
          </LineSymbolizer>
        </Rule>
        <Rule>
          <Name>التسمية</Name>
          <MaxScaleDenominator>36000</MaxScaleDenominator>
          <TextSymbolizer>
            <Label>
              <ogc:PropertyName>VILLAGE_A </ogc:PropertyName>
              <ogc:PropertyName>BLOCK_NO </ogc:PropertyName>
              <ogc:PropertyName> SUB_BLOCK_NO </ogc:PropertyName>
              <ogc:Literal>  </ogc:Literal>
              <ogc:Literal> </ogc:Literal>
            </Label>
            <Font>
              <CssParameter name="font-family">Arial</CssParameter>
              <CssParameter name="font-size">20</CssParameter>
              <CssParameter name="font-style">normal</CssParameter>
              <CssParameter name="font-weight">bold</CssParameter>
            </Font>
            <Fill>
              <CssParameter name="fill">#1a2ee3</CssParameter>
            </Fill>
            <Halo>
              <Radius>1.5</Radius>
              <Fill>
                <CssParameter name="fill">#cafafa</CssParameter>
              </Fill>
            </Halo>
          </TextSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>
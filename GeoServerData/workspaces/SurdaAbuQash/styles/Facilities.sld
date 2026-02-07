<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<StyledLayerDescriptor version="1.0.0" xsi:schemaLocation="http://www.opengis.net/sld StyledLayerDescriptor.xsd" xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <NamedLayer>
    <Name>Facilities</Name>
    <UserStyle>
      <Name>Facilities</Name>
      <Title>Facilities</Title>
      <FeatureTypeStyle>
        <Rule>
          <Name/>
          <MaxScaleDenominator>2000</MaxScaleDenominator>
          <TextSymbolizer>
            <Label>
              <ogc:PropertyName>Feature_Name</ogc:PropertyName>
            </Label>
            <Font>
              <CssParameter name="font-family">Arial</CssParameter>
              <CssParameter name="font-size">23</CssParameter>
              <CssParameter name="font-weight">bold</CssParameter>
            </Font>
            <LabelPlacement>
              <PointPlacement>
                <Displacement>
                  <DisplacementX>20</DisplacementX>
                  <DisplacementY>5</DisplacementY>
                </Displacement>
              </PointPlacement>
            </LabelPlacement>
            <Fill>
              <CssParameter name="fill">#323232</CssParameter>
            </Fill>
            <Halo>
              <Radius>5.5</Radius>
              <Fill>
                <CssParameter name="fill">#b4fafa</CssParameter>
              </Fill>
            </Halo>
          </TextSymbolizer>
        </Rule>
        <Rule>
          <Name>0</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>Types</PropertyName>
              <Literal>0</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>5000</MaxScaleDenominator>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#b80808</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#b80808</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>24</Size>
            </Graphic>
          </PointSymbolizer>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#ff0000</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#ff0000</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>26</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <Rule>
          <Name>1</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>Types</PropertyName>
              <Literal>1</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>5000</MaxScaleDenominator>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#65d5c8</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#b80808</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>25</Size>
            </Graphic>
          </PointSymbolizer>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#65d5c8</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#002fff</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>32</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <Rule>
          <Name>2</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>Types</PropertyName>
              <Literal>2</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>5000</MaxScaleDenominator>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#b80808</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#b80808</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>24</Size>
            </Graphic>
          </PointSymbolizer>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#b80808</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#ff0000</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>26</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <Rule>
          <Name>3</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>Types</PropertyName>
              <Literal>3</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>5000</MaxScaleDenominator>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#ffff00</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#b80808</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>24</Size>
            </Graphic>
          </PointSymbolizer>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#ffff00</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#ff0000</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>26</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <Rule>
          <Name>4</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>Types</PropertyName>
              <Literal>4</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>5000</MaxScaleDenominator>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#1124d1</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#b80808</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>25</Size>
            </Graphic>
          </PointSymbolizer>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#1124d1</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#002fff</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>32</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <Rule>
          <Name>5</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>Types</PropertyName>
              <Literal>5</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>5000</MaxScaleDenominator>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#9fd835</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#b80808</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>25</Size>
            </Graphic>
          </PointSymbolizer>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#9fd835</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#002fff</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>32</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <Rule>
          <Name>6</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>Types</PropertyName>
              <Literal>6</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>5000</MaxScaleDenominator>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#72d596</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#b80808</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>25</Size>
            </Graphic>
          </PointSymbolizer>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#72d596</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#002fff</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>32</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <Rule>
          <Name>7</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>Types</PropertyName>
              <Literal>7</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>5000</MaxScaleDenominator>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#5423d2</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#b80808</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>25</Size>
            </Graphic>
          </PointSymbolizer>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#5423d2</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#002fff</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>32</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <Rule>
          <Name>8</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>Types</PropertyName>
              <Literal>8</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>5000</MaxScaleDenominator>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#c432e8</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#b80808</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>25</Size>
            </Graphic>
          </PointSymbolizer>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#c432e8</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#002fff</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>32</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <Rule>
          <Name>9</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>Types</PropertyName>
              <Literal>9</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>5000</MaxScaleDenominator>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#dd4763</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#b80808</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>25</Size>
            </Graphic>
          </PointSymbolizer>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#dd4763</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#002fff</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>32</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <Rule>
          <Name>10</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>Types</PropertyName>
              <Literal>10</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>5000</MaxScaleDenominator>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#c31ed2</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#b80808</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>25</Size>
            </Graphic>
          </PointSymbolizer>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#c31ed2</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#002fff</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>32</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <Rule>
          <Name>11</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>Types</PropertyName>
              <Literal>11</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>5000</MaxScaleDenominator>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#76cacb</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#b80808</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>25</Size>
            </Graphic>
          </PointSymbolizer>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#76cacb</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#002fff</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>32</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <Rule>
          <Name>12</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>Types</PropertyName>
              <Literal>12</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>5000</MaxScaleDenominator>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#53d753</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#b80808</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>25</Size>
            </Graphic>
          </PointSymbolizer>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#53d753</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#002fff</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>32</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <Rule>
          <Name>13</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>Types</PropertyName>
              <Literal>13</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>5000</MaxScaleDenominator>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#45ce67</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#b80808</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>25</Size>
            </Graphic>
          </PointSymbolizer>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#45ce67</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#002fff</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>32</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <Rule>
          <Name>14</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>Types</PropertyName>
              <Literal>14</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>5000</MaxScaleDenominator>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#ed73c8</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#b80808</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>25</Size>
            </Graphic>
          </PointSymbolizer>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#ed73c8</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#002fff</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>32</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <Rule>
          <Name>15</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>Types</PropertyName>
              <Literal>15</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>5000</MaxScaleDenominator>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#d64c78</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#b80808</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>25</Size>
            </Graphic>
          </PointSymbolizer>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#d64c78</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#002fff</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>32</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <Rule>
          <Name>16</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>Types</PropertyName>
              <Literal>16</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>5000</MaxScaleDenominator>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#ec2431</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#b80808</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>25</Size>
            </Graphic>
          </PointSymbolizer>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#ec2431</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#002fff</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>32</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <Rule>
          <Name>18</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>Types</PropertyName>
              <Literal>18</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>5000</MaxScaleDenominator>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#2e9ee8</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#b80808</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>25</Size>
            </Graphic>
          </PointSymbolizer>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#2e9ee8</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#002fff</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>32</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <Rule>
          <Name>17</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>Types</PropertyName>
              <Literal>17</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>5000</MaxScaleDenominator>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#d231b4</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#b80808</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>25</Size>
            </Graphic>
          </PointSymbolizer>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#d231b4</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#002fff</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>32</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <Rule>
          <Name>19</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>Types</PropertyName>
              <Literal>19</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>5000</MaxScaleDenominator>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#dc9f43</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#b80808</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>25</Size>
            </Graphic>
          </PointSymbolizer>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#dc9f43</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#002fff</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>32</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <Rule>
          <Name>20</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>Types</PropertyName>
              <Literal>20</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>5000</MaxScaleDenominator>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#cb6158</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#b80808</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>25</Size>
            </Graphic>
          </PointSymbolizer>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#cb6158</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#002fff</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>32</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <Rule>
          <Name>21</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>Types</PropertyName>
              <Literal>21</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>5000</MaxScaleDenominator>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#c7e564</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#b80808</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>25</Size>
            </Graphic>
          </PointSymbolizer>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#c7e564</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#002fff</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>32</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <Rule>
          <Name>22</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>Types</PropertyName>
              <Literal>22</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>5000</MaxScaleDenominator>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#18db7a</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#b80808</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>25</Size>
            </Graphic>
          </PointSymbolizer>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#18db7a</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#002fff</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>32</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <Rule>
          <Name>23</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>Types</PropertyName>
              <Literal>23</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>5000</MaxScaleDenominator>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#3fe5a8</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#b80808</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>25</Size>
            </Graphic>
          </PointSymbolizer>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#3fe5a8</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#002fff</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>32</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <Rule>
          <Name>24</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>Types</PropertyName>
              <Literal>24</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>5000</MaxScaleDenominator>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#6eca35</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#b80808</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>25</Size>
            </Graphic>
          </PointSymbolizer>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#6eca35</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#002fff</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>32</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <Rule>
          <Name>25</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>Types</PropertyName>
              <Literal>25</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>5000</MaxScaleDenominator>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#849bef</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#b80808</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>25</Size>
            </Graphic>
          </PointSymbolizer>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#849bef</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#002fff</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>32</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <Rule>
          <Name>26</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>Types</PropertyName>
              <Literal>26</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>5000</MaxScaleDenominator>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#d74989</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#b80808</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>25</Size>
            </Graphic>
          </PointSymbolizer>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#d74989</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#002fff</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>32</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <Rule>
          <Name>27</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>Types</PropertyName>
              <Literal>27</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>5000</MaxScaleDenominator>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#4f93dc</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#b80808</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>25</Size>
            </Graphic>
          </PointSymbolizer>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#4f93dc</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#002fff</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>32</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <Rule>
          <Name>28</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>Types</PropertyName>
              <Literal>28</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>5000</MaxScaleDenominator>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#36ecbe</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#b80808</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>25</Size>
            </Graphic>
          </PointSymbolizer>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#36ecbe</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#002fff</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>32</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <Rule>
          <Name>29</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>Types</PropertyName>
              <Literal>29</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>5000</MaxScaleDenominator>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#aa5bd1</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#b80808</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>25</Size>
            </Graphic>
          </PointSymbolizer>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#aa5bd1</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#002fff</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>32</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <Rule>
          <Name>30</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>Types</PropertyName>
              <Literal>30</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>5000</MaxScaleDenominator>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#edb07b</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#b80808</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>25</Size>
            </Graphic>
          </PointSymbolizer>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#edb07b</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#002fff</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>32</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <Rule>
          <Name>31</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>Types</PropertyName>
              <Literal>31</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>5000</MaxScaleDenominator>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#33c1d7</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#b80808</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>25</Size>
            </Graphic>
          </PointSymbolizer>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#33c1d7</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#002fff</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>32</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <Rule>
          <Name>32</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>Types</PropertyName>
              <Literal>32</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>5000</MaxScaleDenominator>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#d0579c</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#b80808</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>25</Size>
            </Graphic>
          </PointSymbolizer>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#d0579c</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#002fff</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>32</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <Rule>
          <Name>33</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>Types</PropertyName>
              <Literal>33</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>5000</MaxScaleDenominator>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#6ebfdc</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#b80808</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>25</Size>
            </Graphic>
          </PointSymbolizer>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#6ebfdc</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#002fff</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>32</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <Rule>
          <Name>34</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>Types</PropertyName>
              <Literal>34</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>5000</MaxScaleDenominator>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#2ce310</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#b80808</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>25</Size>
            </Graphic>
          </PointSymbolizer>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#2ce310</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#002fff</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>32</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <Rule>
          <Name>35</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>Types</PropertyName>
              <Literal>35</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>5000</MaxScaleDenominator>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#c6d256</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#b80808</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>25</Size>
            </Graphic>
          </PointSymbolizer>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#c6d256</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#002fff</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>32</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <Rule>
          <Name>36</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>Types</PropertyName>
              <Literal>36</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>5000</MaxScaleDenominator>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#e34edc</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#b80808</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>25</Size>
            </Graphic>
          </PointSymbolizer>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#e34edc</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#002fff</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>32</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <Rule>
          <Name>37</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>Types</PropertyName>
              <Literal>37</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>5000</MaxScaleDenominator>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#d29c12</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#b80808</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>25</Size>
            </Graphic>
          </PointSymbolizer>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#d29c12</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#002fff</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>32</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <Rule>
          <Name>38</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>Types</PropertyName>
              <Literal>38</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>5000</MaxScaleDenominator>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#9851d6</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#b80808</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>25</Size>
            </Graphic>
          </PointSymbolizer>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#9851d6</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#002fff</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>32</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <Rule>
          <Name>39</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>Types</PropertyName>
              <Literal>39</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>5000</MaxScaleDenominator>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#53d026</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#b80808</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>25</Size>
            </Graphic>
          </PointSymbolizer>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#53d026</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#002fff</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>32</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <Rule>
          <Name>41</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>Types</PropertyName>
              <Literal>41</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>5000</MaxScaleDenominator>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#8e80dd</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#b80808</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>25</Size>
            </Graphic>
          </PointSymbolizer>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#8e80dd</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#002fff</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>32</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <Rule>
          <Name>42</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>Types</PropertyName>
              <Literal>42</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>5000</MaxScaleDenominator>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#e79983</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#b80808</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>25</Size>
            </Graphic>
          </PointSymbolizer>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#e79983</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#002fff</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>32</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <Rule>
          <Name>44</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>Types</PropertyName>
              <Literal>44</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>5000</MaxScaleDenominator>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#9a77cb</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#b80808</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>25</Size>
            </Graphic>
          </PointSymbolizer>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#9a77cb</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#002fff</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>32</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <Rule>
          <Name>45</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>Types</PropertyName>
              <Literal>45</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>5000</MaxScaleDenominator>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#6d97e6</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#b80808</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>25</Size>
            </Graphic>
          </PointSymbolizer>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#6d97e6</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#002fff</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>32</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <Rule>
          <Name>46</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>Types</PropertyName>
              <Literal>46</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>5000</MaxScaleDenominator>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#7571e9</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#b80808</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>25</Size>
            </Graphic>
          </PointSymbolizer>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#7571e9</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#002fff</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>32</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <Rule>
          <Name>47</Name>
          <Filter xmlns="http://www.opengis.net/ogc">
            <PropertyIsEqualTo>
              <PropertyName>Types</PropertyName>
              <Literal>47</Literal>
            </PropertyIsEqualTo>
          </Filter>
          <MaxScaleDenominator>5000</MaxScaleDenominator>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#eedd7f</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#b80808</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>25</Size>
            </Graphic>
          </PointSymbolizer>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>star</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#eedd7f</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#002fff</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>32</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>
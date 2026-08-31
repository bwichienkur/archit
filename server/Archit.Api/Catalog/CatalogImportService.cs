using System.Globalization;
using System.IO.Compression;
using System.Text;
using System.Text.Json;
using System.Xml.Linq;

namespace Archit.Api.Catalog;

public sealed record CatalogImportIssue(int Row,string? Field,string Message);
public sealed record CatalogImportPreview(string FileName,string Format,int SourceRowCount,IReadOnlyList<UpsertCatalogProductRequest> Products,IReadOnlyList<CatalogImportIssue> Issues);
public sealed record ApplyCatalogImportRequest(IReadOnlyList<UpsertCatalogProductRequest> Products);
public sealed record ApplyCatalogImportResult(int Applied,IReadOnlyList<CatalogProductRecord> Products);

public sealed class CatalogImportService
{
    private static readonly HashSet<string> Categories=new(StringComparer.OrdinalIgnoreCase){"flooring","tile","roofing","cabinet","countertop","faucet","sink","plumbing-fixture","lighting","appliance","door","window","hardware","baseboard","crown-molding","paint","stone","paver","furniture"};
    private static readonly HashSet<string> Units=new(StringComparer.OrdinalIgnoreCase){"each","sqft","linear-ft","box","gallon"};
    private static readonly string[] Required=["id","manufacturer","sku","name","category","unitOfMeasure"];

    public async Task<CatalogImportPreview> PreviewAsync(string fileName,Stream stream,CancellationToken cancellationToken)
    {
        var extension=Path.GetExtension(fileName).ToLowerInvariant();
        IReadOnlyList<IReadOnlyList<string>> rows=extension switch
        {
            ".csv"=>ParseCsv(await ReadUtf8Async(stream,cancellationToken)),
            ".xlsx"=>await ParseXlsxAsync(stream,cancellationToken),
            _=>throw new InvalidOperationException("Catalog imports support .csv and .xlsx files."),
        };
        return BuildPreview(Path.GetFileName(fileName),extension.TrimStart('.'),rows);
    }

    public async Task<ApplyCatalogImportResult> ApplyAsync(ApplyCatalogImportRequest request,ICatalogRepository repository,CancellationToken cancellationToken)
    {
        if(request.Products.Count==0)throw new InvalidOperationException("At least one reviewed catalog product is required.");
        var duplicates=request.Products.GroupBy(item=>item.ExternalId,StringComparer.OrdinalIgnoreCase).Where(group=>group.Count()>1).Select(group=>group.Key).ToArray();
        if(duplicates.Length>0)throw new InvalidOperationException($"Duplicate catalog product ids: {string.Join(", ",duplicates)}.");
        var records=new List<CatalogProductRecord>(request.Products.Count);
        foreach(var product in request.Products)records.Add(await repository.UpsertAsync(product,cancellationToken));
        return new ApplyCatalogImportResult(records.Count,records);
    }

    private static CatalogImportPreview BuildPreview(string fileName,string format,IReadOnlyList<IReadOnlyList<string>> rows)
    {
        var issues=new List<CatalogImportIssue>();var products=new List<UpsertCatalogProductRequest>();
        if(rows.Count==0)return new CatalogImportPreview(fileName,format,0,products,[new CatalogImportIssue(0,null,"Catalog file is empty.")]);
        var headers=rows[0].Select(value=>value.Trim()).ToArray();
        foreach(var field in Required)if(!headers.Contains(field,StringComparer.Ordinal))issues.Add(new CatalogImportIssue(1,field,$"Missing required column {field}."));
        if(issues.Count>0)return new CatalogImportPreview(fileName,format,Math.Max(0,rows.Count-1),products,issues);
        var indexes=headers.Select((header,index)=>(header,index)).ToDictionary(item=>item.header,item=>item.index,StringComparer.Ordinal);
        for(var rowIndex=1;rowIndex<rows.Count;rowIndex++)
        {
            var cells=rows[rowIndex];if(cells.All(string.IsNullOrWhiteSpace))continue;var row=rowIndex+1;
            string Value(string name)=>indexes.TryGetValue(name,out var index)&&index<cells.Count?cells[index].Trim():string.Empty;
            var missing=new[]{"id","manufacturer","sku","name"}.Where(field=>string.IsNullOrWhiteSpace(Value(field))).ToArray();
            foreach(var field in missing)issues.Add(new CatalogImportIssue(row,field,$"{field} is required."));
            var category=Value("category");var unit=Value("unitOfMeasure");
            if(!Categories.Contains(category))issues.Add(new CatalogImportIssue(row,"category",$"Unknown product category {category}."));
            if(!Units.Contains(unit))issues.Add(new CatalogImportIssue(row,"unitOfMeasure",$"Unknown unit of measure {unit}."));
            var numericFields=new[]{"width","height","depth","coveragePerUnit","defaultWasteFactor","materialCost","laborCost","markupPercent"};
            foreach(var field in numericFields){var value=Value(field);if(value.Length>0&&!double.TryParse(value,NumberStyles.Float,CultureInfo.InvariantCulture,out _))issues.Add(new CatalogImportIssue(row,field,$"{field} must be numeric."));}
            var hasDimension=numericFields.Take(3).Any(field=>Value(field).Length>0);var dimensionUnit=Value("dimensionUnit");
            if(hasDimension&&dimensionUnit is not ("in" or "mm"))issues.Add(new CatalogImportIssue(row,"dimensionUnit","dimensionUnit must be in or mm when dimensions are supplied."));
            if(issues.Any(issue=>issue.Row==row))continue;
            var payload=new Dictionary<string,object?>(StringComparer.Ordinal);
            for(var column=0;column<headers.Length;column++){
                var header=headers[column];if(string.IsNullOrWhiteSpace(header))continue;var raw=column<cells.Count?cells[column].Trim():string.Empty;if(raw.Length==0)continue;
                payload[header]=numericFields.Contains(header)&&double.TryParse(raw,NumberStyles.Float,CultureInfo.InvariantCulture,out var number)?number:raw;
            }
            products.Add(new UpsertCatalogProductRequest(Value("id"),Value("manufacturer"),Value("sku"),Value("name"),category,unit,JsonSerializer.SerializeToElement(payload)));
        }
        foreach(var duplicate in products.GroupBy(product=>product.ExternalId,StringComparer.OrdinalIgnoreCase).Where(group=>group.Count()>1))issues.Add(new CatalogImportIssue(0,"id",$"Duplicate product id {duplicate.Key}."));
        return new CatalogImportPreview(fileName,format,Math.Max(0,rows.Count-1),products,issues);
    }

    private static async Task<IReadOnlyList<IReadOnlyList<string>>> ParseXlsxAsync(Stream input,CancellationToken cancellationToken)
    {
        using var copy=new MemoryStream();await input.CopyToAsync(copy,cancellationToken);copy.Position=0;
        using var archive=new ZipArchive(copy,ZipArchiveMode.Read,leaveOpen:false);
        var shared=ReadSharedStrings(archive);
        var sheetPath=ResolveFirstSheetPath(archive);
        var sheet=archive.GetEntry(sheetPath)??throw new InvalidOperationException($"XLSX worksheet {sheetPath} was not found.");
        await using var stream=sheet.Open();var document=await XDocument.LoadAsync(stream,LoadOptions.None,cancellationToken);
        XNamespace ns="http://schemas.openxmlformats.org/spreadsheetml/2006/main";
        var rows=new List<IReadOnlyList<string>>();
        foreach(var row in document.Descendants(ns+"row")){
            var cells=new SortedDictionary<int,string>();
            foreach(var cell in row.Elements(ns+"c")){
                var reference=(string?)cell.Attribute("r")??string.Empty;var column=ColumnIndex(reference);var type=(string?)cell.Attribute("t");
                var raw=cell.Element(ns+"v")?.Value??cell.Element(ns+"is")?.Descendants(ns+"t").Select(node=>node.Value).Aggregate(string.Empty,(a,b)=>a+b)??string.Empty;
                var value=type=="s"&&int.TryParse(raw,out var sharedIndex)&&sharedIndex>=0&&sharedIndex<shared.Count?shared[sharedIndex]:raw;
                cells[column]=value;
            }
            if(cells.Count==0){rows.Add(Array.Empty<string>());continue;}
            var values=Enumerable.Repeat(string.Empty,cells.Keys.Max()+1).ToArray();foreach(var (column,value) in cells)values[column]=value;rows.Add(values);
        }
        return rows;
    }

    private static List<string> ReadSharedStrings(ZipArchive archive)
    {
        var entry=archive.GetEntry("xl/sharedStrings.xml");if(entry is null)return[];using var stream=entry.Open();var document=XDocument.Load(stream);XNamespace ns="http://schemas.openxmlformats.org/spreadsheetml/2006/main";
        return document.Descendants(ns+"si").Select(item=>string.Concat(item.Descendants(ns+"t").Select(node=>node.Value))).ToList();
    }

    private static string ResolveFirstSheetPath(ZipArchive archive)
    {
        var workbookEntry=archive.GetEntry("xl/workbook.xml")??throw new InvalidOperationException("XLSX workbook.xml was not found.");
        using var workbookStream=workbookEntry.Open();var workbook=XDocument.Load(workbookStream);XNamespace main="http://schemas.openxmlformats.org/spreadsheetml/2006/main";XNamespace rel="http://schemas.openxmlformats.org/officeDocument/2006/relationships";
        var relationshipId=(string?)workbook.Descendants(main+"sheet").FirstOrDefault()?.Attribute(rel+"id")??throw new InvalidOperationException("XLSX does not contain a worksheet.");
        var relEntry=archive.GetEntry("xl/_rels/workbook.xml.rels")??throw new InvalidOperationException("XLSX workbook relationships were not found.");
        using var relStream=relEntry.Open();var relationships=XDocument.Load(relStream);XNamespace packageRel="http://schemas.openxmlformats.org/package/2006/relationships";
        var target=(string?)relationships.Descendants(packageRel+"Relationship").FirstOrDefault(item=>(string?)item.Attribute("Id")==relationshipId)?.Attribute("Target")??throw new InvalidOperationException("XLSX first worksheet relationship could not be resolved.");
        target=target.Replace('\\','/').TrimStart('/');return target.StartsWith("xl/",StringComparison.Ordinal)?target:"xl/"+target;
    }

    private static int ColumnIndex(string cellReference){var index=0;foreach(var character in cellReference){if(character is<'A'or>'Z'&&character is<'a'or>'z')break;var upper=char.ToUpperInvariant(character);index=index*26+(upper-'A'+1);}return Math.Max(0,index-1);}
    private static async Task<string> ReadUtf8Async(Stream stream,CancellationToken cancellationToken){using var reader=new StreamReader(stream,Encoding.UTF8,detectEncodingFromByteOrderMarks:true,leaveOpen:true);return await reader.ReadToEndAsync(cancellationToken);}
    private static IReadOnlyList<IReadOnlyList<string>> ParseCsv(string input){var rows=new List<IReadOnlyList<string>>();var row=new List<string>();var cell=new StringBuilder();var quoted=false;for(var i=0;i<input.Length;i++){var ch=input[i];if(ch=='\"'){if(quoted&&i+1<input.Length&&input[i+1]=='\"'){cell.Append('\"');i++;}else quoted=!quoted;}else if(ch==','&&!quoted){row.Add(cell.ToString());cell.Clear();}else if((ch=='\n'||ch=='\r')&&!quoted){if(ch=='\r'&&i+1<input.Length&&input[i+1]=='\n')i++;row.Add(cell.ToString());rows.Add(row);row=[];cell.Clear();}else cell.Append(ch);}if(cell.Length>0||row.Count>0){row.Add(cell.ToString());rows.Add(row);}return rows;}
}

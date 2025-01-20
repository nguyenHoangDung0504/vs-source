/**
 * @template T
 * - Thư viện hỗ trợ render danh sách dữ liệu từ mẫu HTML và dữ liệu.
 */
export default class ListView {
    /**
     * @static
     * - Thuộc tính cần đặt cho phần tử HTML để định nghĩa phần tử đó là container của `ListView`
     * - Có thể thay đổi nhằm mục đích viết tắt hoặc tránh trùng lặp trong trường hợp hy hữu
     */
    static CONTAINER_ATTRIBUTE = 'lv-container';

    /**
     * @static
     * - Thuộc tính cần đặt cho phần tử HTML đầu tiên trong container của `ListView` để định nghĩa phần tử đó là mẫu để `ListView` render
     * - Có thể thay đổi nhằm mục đích viết tắt hoặc tránh trùng lặp trong trường hợp hy hữu
     */
    static TEMPLATE_ATTRIBUTE = 'lv-template';

    /**
     * @static
     * - Thuộc tính dùng để debug, khi đặt bằng `true`, ListView sẽ log các thông tin chi tiết hơn
     */
    static LOG = true;

    /**
     * @private
     * @type {new (...args: any[]) => T}
     * - Lớp định nghĩa kiểu dữ liệu của các phần tử trong danh sách
     */
    _DataType;

    /**
     * @private
     * @type {HTMLElement}
     * - Phần tử HTML chứa danh sách
     */
    _listContainer;

    /**
     * @private
     * @type {HTMLElement}
     * - Mẫu HTML (template) đại diện cho từng phần tử trong danh sách
     */
    _itemTemplate;

    /**
     * @private
     * @type {(template: HTMLElement, data: T) => void}
     * - Hàm xử lý logic binding dữ liệu vào mẫu HTML
     */
    _dataBinder = null;

    /**
     * @private
     * @type {T[]}
     * - Bộ dữ liệu để render thành danh sách
     */
    dataCollection = [];

    /**
     * @private
     * @type {(item: HTMLElement, data: T) => void}
     * - Hook được gọi trước khi thêm phần tử vào danh sách
     */
    _beforeItemAdded;

    /**
     * @private
     * @type {(item: HTMLElement, data: T) => void}
     * - Hook được gọi sau khi thêm phần tử vào danh sách
     */
    _afterItemAdded;

    /**
     * @private
     * @type {() => void}
     * - Hook được gọi trước khi render danh sách
     */
    _beforeRender;

    /**
     * @private
     * @type {() => void}
     * - Hook được gọi sau khi render danh sách
     */
    _afterRender;

    /**
     * Khởi tạo một instance của ListView
     * @param {new (...args: any[]) => T} DataType - Lớp định nghĩa kiểu dữ liệu
     * @param {HTMLElement} listContainer - Container chứa danh sách
     * @param {(template: HTMLElement, data: T) => void} dataBinder - Hàm xử lý binding dữ liệu
     */
    constructor(DataType, listContainer, dataBinder) {
        this._DataType = DataType;

        // Kiểm tra và thiết lập container
        this._listContainer = listContainer;
        if (!(listContainer instanceof HTMLElement)) {
            throw new TypeError(
                "ListView error: Container phải là một instance hợp lệ của HTMLElement. Vui lòng kiểm tra lại."
            );
        }

        // Kiểm tra thuộc tính container
        if (!listContainer.hasAttribute(ListView.CONTAINER_ATTRIBUTE)) {
            throw new Error(
                `ListView error: Container của ListView phải được đánh dấu bằng thuộc tính '${ListView.CONTAINER_ATTRIBUTE}'.`
            );
        }

        // Kiểm tra số lượng phần tử con trong container
        if (listContainer.childElementCount > 1) {
            ListView.LOG && console.warn(
                `ListView warning: Trong container được cấp có nhiều phần tử con, ListView chỉ lấy phần tử đầu tiên.
                Xem lại container nếu cần thiết:`, listContainer
            );
        }

        // Kiểm tra mẫu HTML
        this._itemTemplate = this._listContainer.firstElementChild?.cloneNode(true);
        if (!this._itemTemplate) {
            throw new Error(
                "ListView error: Không thể tìm thấy mẫu HTML hợp lệ bên trong container. Vui lòng kiểm tra lại."
            );
        }

        // Kiểm tra thuộc tính template
        if (!this._listContainer.firstElementChild.hasAttribute(ListView.TEMPLATE_ATTRIBUTE)) {
            ListView.LOG && console.error(
                "*ListView log debug: Phần tử không có thuộc tính template.",
                this._listContainer.firstElementChild
            );
            throw new Error(
                `ListView error: Phần tử được sử dụng làm mẫu phải được đánh dấu bằng thuộc tính '${ListView.TEMPLATE_ATTRIBUTE}'.`
            );
        }

        // Kiểm tra dataBinder
        if (typeof dataBinder !== "function") {
            throw new Error("ListView error: 'dataBinder' phải là một hàm hợp lệ.");
        }

        this._dataBinder = dataBinder;

        // Xóa nội dung template khỏi container
        this._itemTemplate.removeAttribute(ListView.TEMPLATE_ATTRIBUTE);
        this._listContainer.innerHTML = "";
    }

    /**
     * Thiết lập dữ liệu và render danh sách
     * @param {T[]} dataCollection - Danh sách dữ liệu
     */
    setDataCollection(dataCollection) {
        if (!Array.isArray(dataCollection)) {
            throw new Error(
                `ListView error: Dữ liệu phải là một mảng chứa các phần tử thuộc kiểu '${this._DataType.name}'.`
            );
        }
        this.dataCollection = dataCollection;
        this.render();
    }

    /**
     * Cài đặt callback cho sự kiện trước khi thêm một phần tử vào giao diện
     * @param {(item: HTMLElement, data: T) => void} callback - Hàm callback sẽ được gọi trước khi thêm phần tử
     * @returns {this} - Trả về chính đối tượng hiện tại để hỗ trợ chain
     */
    beforeItemAddedCall(callback) {
        this._beforeItemAdded = callback;
        return this;
    }

    /**
     * Cài đặt callback cho sự kiện sau khi một phần tử đã được thêm vào giao diện
     * @param {(item: HTMLElement, data: T) => void} callback - Hàm callback sẽ được gọi sau khi thêm phần tử
     * @returns {this} - Trả về chính đối tượng hiện tại để hỗ trợ chain
     */
    afterItemAddedCall(callback) {
        this._afterItemAdded = callback;
        return this;
    }

    /**
     * Cài đặt callback cho sự kiện trước khi bắt đầu quá trình render giao diện
     * @param {() => void} callback - Hàm callback sẽ được gọi trước khi bắt đầu render
     * @returns {this} - Trả về chính đối tượng hiện tại để hỗ trợ chain
     */
    beforeRenderCall(callback) {
        this._beforeRender = callback;
        return this;
    }

    /**
     * Cài đặt callback cho sự kiện sau khi hoàn thành quá trình render giao diện
     * @param {() => void} callback - Hàm callback sẽ được gọi sau khi hoàn thành render
     * @returns {this} - Trả về chính đối tượng hiện tại để hỗ trợ chain
     */
    afterRenderCall(callback) {
        this._afterRender = callback;
        return this;
    }

    /**
     * Render danh sách dựa trên dữ liệu hiện tại
     */
    render() {
        if (!this._dataBinder) {
            throw new Error(
                "ListView error: 'dataBinder' cần được thiết lập trước khi gọi 'render'."
            );
        }

        if (this._beforeRender) this._beforeRender();

        // Làm rỗng container trước khi render
        this._listContainer.innerHTML = "";

        this.dataCollection.forEach((data, index) => {
            if (!(data instanceof this._DataType)) {
                ListView.LOG && console.error(
                    `*ListView log debug: Phần tử không hợp lệ ở index ${index}.`,
                    data
                );
                throw new Error(
                    `ListView error: Phần tử tại index ${index} không phải là instance của lớp '${this._DataType.name}'.`
                );
            }

            // Tạo binder và xử lý binding
            this._dataBinder(this._itemTemplate.cloneNode(true), data);

            // Gọi hook trước khi thêm phần tử
            if (this._beforeItemAdded) this._beforeItemAdded(binder.root, data);

            // Thêm phần tử vào container
            this._listContainer.appendChild(binder.root);

            // Gọi hook sau khi thêm phần tử
            if (this._afterItemAdded) this._afterItemAdded(binder.root, data);
        });

        if (this._afterRender) this._afterRender();
    }

    /**
     * Tạo một dataBinder với kiểu dữ liệu được định nghĩa sẵn
     * @template T
     * @param {new (...args: any[]) => T} DataType - Kiểu dữ liệu
     * @param {(template: HTMLElement, data: T) => void} binderFunction - Hàm xử lý binding
     * @returns {(template: HTMLElement, data: T) => void}
     */
    static createDataBinder(DataType, binderFunction) {
        return (binding, data) => {
            if (!(data instanceof DataType)) {
                throw new Error(
                    `ListView error: binderFunction error: Dữ liệu truyền vào phải là instance của lớp '${DataType.name}'.`
                );
            }
            binderFunction(binding, data);
        };
    }
}